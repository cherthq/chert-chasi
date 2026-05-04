import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ensureLayout } from "@/lib/sheets";
import { seedDefaults } from "@/lib/settings";
import { subscribeWebhook, listPhoneNumbers } from "@/lib/chert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    webhook_url?: string;
  };

  await ensureLayout();
  await seedDefaults();

  const webhookUrl = body.webhook_url ?? `${env.APP_URL}/api/webhooks/chert`;
  let subscription: unknown = null;
  try {
    subscription = await subscribeWebhook(webhookUrl);
  } catch (e) {
    return NextResponse.json(
      {
        sheet: "ok",
        webhook: { error: String(e), attempted_url: webhookUrl },
      },
      { status: 200 }
    );
  }

  let phone_numbers: unknown = null;
  try {
    phone_numbers = await listPhoneNumbers();
  } catch (e) {
    phone_numbers = { error: String(e) };
  }

  return NextResponse.json({
    sheet: "ok",
    webhook: { url: webhookUrl, subscription },
    phone_numbers,
  });
}
