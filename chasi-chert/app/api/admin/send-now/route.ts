import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { sendOnePending } from "@/app/api/cron/tick/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.ADMIN_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await getSettings();
  return sendOnePending(settings);
}
