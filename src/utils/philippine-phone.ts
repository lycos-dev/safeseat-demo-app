/**
 * Normalize a Philippine mobile number to E.164 (+639XXXXXXXXX).
 *
 * Accepted examples:
 *   09171234567
 *   +639171234567
 *   639171234567
 *   9171234567
 *
 * Spaces, parentheses, hyphens and periods are ignored. Any other character
 * (including letters) makes the value invalid.
 */
export function normalizePhilippineMobileNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !/^[+()\d\s.-]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");

  if (/^09\d{9}$/.test(digits)) {
    digits = `63${digits.slice(1)}`;
  } else if (/^9\d{9}$/.test(digits)) {
    digits = `63${digits}`;
  }

  if (!/^639\d{9}$/.test(digits)) return null;
  return `+${digits}`;
}

export function isValidPhilippineMobileNumber(value: string): boolean {
  return normalizePhilippineMobileNumber(value) !== null;
}

export const PH_MOBILE_VALIDATION_MESSAGE = "Enter a valid Philippine mobile number.";
