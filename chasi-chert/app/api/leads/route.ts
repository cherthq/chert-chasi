import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { readLeads } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.ADMIN_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const leads = await readLeads();
  return NextResponse.json({ leads });
}
