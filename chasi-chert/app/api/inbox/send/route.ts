import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendIntoChat, setTyping } from "@/lib/chert";
import { appendMessageLog, findLeadByChatId } from "@/lib/sheets";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${env.ADMIN_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    chat_id?: string;
    text?: string;
  };
  const chatId = body.chat_id?.trim();
  const text = body.text?.trim();
  if (!chatId || !text)
    return NextResponse.json(
      { error: "missing chat_id or text" },
      { status: 400 }
    );
  const settings = await getSettings();

  try {
    await setTyping(chatId, "typing");
  } catch {}

  try {
    const result = await sendIntoChat(chatId, text, {
      test_lead: settings.test_mode,
    });
    const lead = await findLeadByChatId(chatId);
    if (lead) {
      const now = new Date().toISOString();
      await appendMessageLog(lead.rowIndex, {
        ts: now,
        direction: "out",
        message_id: result.message_id,
        text,
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  } finally {
    try {
      await setTyping(chatId, "stopped");
    } catch {}
  }
}
