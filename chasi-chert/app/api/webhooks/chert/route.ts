import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  findLeadByChatId,
  findLeadByPhone,
  updateLead,
  appendMessageLog,
} from "@/lib/sheets";
import { getSettings } from "@/lib/settings";
import { chatHistory, sendIntoChat, setTyping, react } from "@/lib/chert";
import { generateReply } from "@/lib/openai";
import { verifyWebhookSignature } from "@/lib/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const ok = verifyWebhookSignature({
    rawBody: raw,
    header: req.headers.get("x-webhook-signature"),
    timestampHeader: req.headers.get("x-webhook-timestamp"),
    secret: env.CHERT_WEBHOOK_SECRET,
  });
  if (!ok) {
    // Also accept the legacy x-chert-signature so we don't drop deliveries
    const legacy = req.headers.get("x-chert-signature") ?? "";
    const m = legacy.match(/^v1,(\d+),([0-9a-f]+)$/i);
    let legacyOk = false;
    if (m) {
      legacyOk = verifyWebhookSignature({
        rawBody: raw,
        header: `t=${m[1]},v1=${m[2]}`,
        timestampHeader: null,
        secret: env.CHERT_SIGNING_SECRET,
      });
    }
    if (!legacyOk)
      return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Ack fast — process in background but await briefly
  // Vercel functions need response within request handler; we'll just process
  // synchronously since one message at a time is fine for one line.
  try {
    await handleEvent(event);
  } catch (e) {
    console.error("webhook handler error", e);
  }
  return NextResponse.json({ ok: true });
}

type ChertEvent = {
  type?: string;
  event_id?: string;
  lead_id?: string;
  convo_id?: string;
  payload?: {
    event_type?: string;
    data?: {
      chat?: { id?: string; is_group?: boolean };
      message?: {
        id?: string;
        parts?: { type: string; value?: string }[];
        sent_at?: string;
        direction?: string;
        sender_handle?: { handle?: string; is_me?: boolean };
      };
    };
  };
};

async function handleEvent(eventRaw: Record<string, unknown>) {
  const event = eventRaw as ChertEvent;
  const type = event.type ?? event.payload?.event_type;
  if (type !== "message.received" && type !== "lead_reply") return;

  const data = event.payload?.data;
  const message = data?.message;
  // Only handle inbound from the lead
  if (!message || message.direction !== "inbound") return;
  if (message.sender_handle?.is_me) return;

  const chatId = data?.chat?.id ?? event.lead_id ?? "";
  const senderPhone = message.sender_handle?.handle ?? "";
  const text = (message.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.value ?? "")
    .join(" ")
    .trim();
  const inboundMessageId = message.id;

  // Resolve the row: chat_id first (set when we sent outbound), else by phone
  let lead = chatId ? await findLeadByChatId(chatId) : null;
  if (!lead && senderPhone) lead = await findLeadByPhone(senderPhone);
  if (!lead) {
    console.warn("inbound from unknown lead", { chatId, senderPhone });
    return;
  }

  const now = new Date().toISOString();
  await updateLead(lead.rowIndex, {
    status: "responded",
    chat_id: chatId || lead.chat_id,
    last_inbound_at: now,
    last_excerpt: text.slice(0, 240),
    error: "",
  });
  if (text) {
    await appendMessageLog(lead.rowIndex, {
      ts: message.sent_at ?? now,
      direction: "in",
      message_id: inboundMessageId,
      text,
    });
  }

  const settings = await getSettings();
  if (!settings.auto_reply) return;
  if (!chatId) return;

  // Tap-back to acknowledge receipt
  if (inboundMessageId) {
    try {
      await react(inboundMessageId, "love");
    } catch (e) {
      console.warn("react failed", e);
    }
  }

  try {
    await setTyping(chatId, "typing");
  } catch {}

  let history: { role: "user" | "assistant"; content: string }[] = [];
  try {
    const msgs = await chatHistory(chatId);
    history = msgs
      .map((m) => {
        const value = (m.parts ?? [])
          .filter((p) => p.type === "text")
          .map((p) => p.value ?? "")
          .join(" ")
          .trim();
        if (!value) return null;
        return {
          role: m.direction === "outbound" ? "assistant" : "user",
          content: value,
        } as { role: "user" | "assistant"; content: string };
      })
      .filter((x): x is { role: "user" | "assistant"; content: string } => !!x)
      .slice(-12);
  } catch (e) {
    console.warn("history fetch failed", e);
    history = [{ role: "user", content: text }];
  }

  let reply = "";
  try {
    reply = await generateReply({
      systemPrompt: settings.ai_system_prompt,
      history,
      lead: { name: lead.name, company: lead.company },
    });
  } catch (e) {
    console.error("openai failed", e);
    try {
      await setTyping(chatId, "stopped");
    } catch {}
    return;
  }

  if (!reply) {
    try {
      await setTyping(chatId, "stopped");
    } catch {}
    return;
  }

  try {
    const result = await sendIntoChat(chatId, reply, {
      test_lead: settings.test_mode,
    });
    await appendMessageLog(lead.rowIndex, {
      ts: new Date().toISOString(),
      direction: "out",
      message_id: result.message_id,
      text: reply,
    });
  } catch (e) {
    console.error("auto-reply send failed", e);
    await updateLead(lead.rowIndex, {
      error: `auto_reply_send_failed: ${(e as Error).message}`.slice(0, 200),
    });
  }
}
