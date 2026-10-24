/**
 * Normalisation helpers used for duplicate matching, import matching and
 * merging. These are pure functions with unit tests in normalize.test.ts.
 */

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export const DEFAULT_COUNTRY_CALLING_CODE = "233"; // Ghana — default only, never assumed for "+" numbers

/**
 * Normalise a phone number to an E.164-like string ("+233241234567").
 *
 * - "+44 20 7946 0000"  -> "+442079460000"  (international prefix kept)
 * - "00 44 20..."       -> "+4420..."       (00 international prefix)
 * - "024 412 3456"      -> "+233244123456"  (national format, default country)
 * - "233244123456"      -> "+233244123456"  (country code without "+")
 *
 * Returns "" when the input contains no digits.
 */
export function normalizePhone(
  value: string | null | undefined,
  defaultCallingCode: string = DEFAULT_COUNTRY_CALLING_CODE,
): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const hasPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith(defaultCallingCode) && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `+${defaultCallingCode}${digits}`;
}

const PHONE_ALLOWED = /^\+?[\d\s\-().]+$/;

/** Validation: 7–15 digits (E.164 maximum), only common separators. */
export function isPlausiblePhone(value: string): boolean {
  const trimmed = value.trim();
  if (!PHONE_ALLOWED.test(trimmed)) return false;
  const normalized = normalizePhone(trimmed);
  const digitCount = normalized.replace(/\D/g, "").length;
  if (digitCount < 8 || digitCount > 15) return false;
  // Ghanaian numbers: +233 followed by exactly 9 digits.
  if (normalized.startsWith("+233")) return normalized.length === 13;
  return true;
}

/** Human-friendly display for stored phone numbers. */
export function formatPhone(value: string): string {
  const n = normalizePhone(value);
  if (n.startsWith("+233") && n.length === 13) {
    return `+233 ${n.slice(4, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;
  }
  return value.trim();
}
