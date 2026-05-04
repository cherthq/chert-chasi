import { NextRequest, NextResponse } from "next/server";
import { react } from "@/lib/chert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REACTIONS = new Set([
  "love",
  "like",
  "dislike",
  "laugh",
  "emphasize",
  "question",
]);

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    message_id?: string;
    reaction?: string;
  };
  const messageId = body.message_id?.trim();
  const reaction = body.reaction?.trim();
  if (!messageId || !reaction || !REACTIONS.has(reaction))
    return NextResponse.json(
      { error: "missing/invalid message_id or reaction" },
      { status: 400 }
    );
  try {
    await react(
      messageId,
      reaction as
        | "love"
        | "like"
        | "dislike"
        | "laugh"
        | "emphasize"
        | "question"
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
