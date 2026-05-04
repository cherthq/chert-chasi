import { getSettings } from "@/lib/settings";
import { sendOnePending } from "@/app/api/cron/tick/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const settings = await getSettings();
  return sendOnePending(settings);
}
