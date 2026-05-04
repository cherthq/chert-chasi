import { NextResponse } from "next/server";
import { readLeads } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const leads = await readLeads();
  return NextResponse.json({ leads });
}
