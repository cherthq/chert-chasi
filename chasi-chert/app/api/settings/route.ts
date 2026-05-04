import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  DEFAULTS,
  getSettings,
  setSetting,
  type SettingsKey,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${env.ADMIN_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authed(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await getSettings();
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest) {
  if (!authed(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const writes: Promise<void>[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (!(k in DEFAULTS)) continue;
    writes.push(setSetting(k as SettingsKey, String(v)));
  }
  await Promise.all(writes);
  const s = await getSettings();
  return NextResponse.json(s);
}
