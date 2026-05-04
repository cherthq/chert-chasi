import { NextRequest, NextResponse } from "next/server";
import { chatHistory } from "@/lib/chert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chat_id");
  if (!chatId)
    return NextResponse.json({ error: "missing chat_id" }, { status: 400 });
  try {
    const messages = await chatHistory(chatId);
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), chat_id: chatId },
      { status: 502 }
    );
  }
}
