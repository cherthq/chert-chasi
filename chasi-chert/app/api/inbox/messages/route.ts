import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { chatHistory } from "@/lib/chert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${env.ADMIN_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
