/**
 * Normalize a US/CA phone string into E.164 (+1XXXXXXXXXX).
 * Returns the normalized form, or null if we can't confidently produce one.
 *
 * Rules:
 *  - If already +<digits> with 8–15 digits, return as-is.
 *  - Strip everything non-digit.
 *  - 10 digits  → assume US/CA, prefix +1.
 *  - 11 digits starting with 1 → prefix +.
 *  - Otherwise: too ambiguous, return null.
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
