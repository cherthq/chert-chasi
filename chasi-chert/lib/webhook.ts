import crypto from "node:crypto";

export function verifyWebhookSignature(args: {
  rawBody: string;
  header: string | null;
  timestampHeader: string | null;
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  const { rawBody, header, secret, toleranceSeconds = 600 } = args;
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=") as [string, string])
  );
  const ts = parts["t"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;
  const tsNum = Number.parseInt(ts, 10);
  if (Number.isNaN(tsNum)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNum) > toleranceSeconds) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(v1, "hex")
    );
  } catch {
    return false;
  }
}
