import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULTS,
  getSettings,
  setSetting,
  type SettingsKey,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest) {
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
