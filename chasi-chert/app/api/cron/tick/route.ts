import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { readLeads, updateLead } from "@/lib/sheets";
import { getSettings, renderTemplate, setSetting } from "@/lib/settings";
import { sendText, enrichContact } from "@/lib/chert";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${env.CRON_SECRET}`)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runTick();
}

export async function POST(req: NextRequest) {
  return GET(req);
}

async function runTick() {
  const settings = await getSettings();
  if (!settings.auto_send) {
    return NextResponse.json({ skipped: "auto_send_off" });
  }
  const intervalMs = settings.send_interval_minutes * 60 * 1000;
  const last = settings.last_global_send_at
    ? new Date(settings.last_global_send_at).getTime()
    : 0;
  const elapsed = Date.now() - last;
  if (last && elapsed < intervalMs) {
    return NextResponse.json({
      skipped: "within_cooldown",
      elapsed_seconds: Math.round(elapsed / 1000),
      cooldown_seconds: Math.round(intervalMs / 1000),
    });
  }
  return sendOnePending(settings);
}

export async function sendOnePending(settings: {
  template: string;
  ai_system_prompt: string;
  test_mode?: boolean;
}) {
  const leads = await readLeads();
  const next = leads.find(
    (l) => (l.status === "" || l.status === "pending") && (l.phone || l.linkedin_url)
  );
  if (!next) return NextResponse.json({ skipped: "no_pending" });

  let phone = next.phone;
  if (phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      await updateLead(next.rowIndex, {
        status: "needs_attention",
        error: `bad_phone_format: "${phone}" — expected +1XXXXXXXXXX or 10/11 digits`,
      });
      return NextResponse.json({ skipped: "bad_phone", lead: next.rowIndex });
    }
    if (normalized !== phone) {
      await updateLead(next.rowIndex, { phone: normalized });
      phone = normalized;
    }
  }
  if (!phone && next.linkedin_url) {
    try {
      const r = await enrichContact({
        linkedin_url: next.linkedin_url,
        wait_ms: 15000,
      });
      if (r.ok) {
        phone = normalizePhone(r.phone) ?? r.phone;
        await updateLead(next.rowIndex, { phone });
      } else {
        await updateLead(next.rowIndex, {
          status: "needs_attention",
          error: `enrich_no_match`,
        });
        return NextResponse.json({ enriched: false, lead: next.rowIndex });
      }
    } catch (e) {
      await updateLead(next.rowIndex, {
        status: "needs_attention",
        error: `enrich_failed: ${(e as Error).message}`.slice(0, 200),
      });
      return NextResponse.json({ enrich_error: String(e), lead: next.rowIndex });
    }
  }

  if (!phone) {
    await updateLead(next.rowIndex, {
      status: "needs_attention",
      error: "no_phone",
    });
    return NextResponse.json({ skipped: "no_phone", lead: next.rowIndex });
  }

  const body = renderTemplate(settings.template, {
    name: next.name || "there",
    company: next.company || "your team",
  });

  try {
    const result = await sendText(phone, body, {
      test_lead: !!settings.test_mode,
    });
    const now = new Date().toISOString();
    await updateLead(next.rowIndex, {
      status: "sent",
      chat_id: result.chat_id,
      last_outbound_at: now,
      error: "",
    });
    await setSetting("last_global_send_at", now);
    return NextResponse.json({
      sent: true,
      lead: next.rowIndex,
      chat_id: result.chat_id,
    });
  } catch (e) {
    await updateLead(next.rowIndex, {
      status: "needs_attention",
      error: `send_failed: ${(e as Error).message}`.slice(0, 200),
    });
    return NextResponse.json({ send_error: String(e), lead: next.rowIndex }, { status: 500 });
  }
}
