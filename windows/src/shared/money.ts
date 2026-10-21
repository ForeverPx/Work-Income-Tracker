import Decimal from "decimal.js";

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

const POSITIVE_DECIMAL = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

/** Trim and treat a comma as a decimal point, matching AppSettings entry on macOS. */
export function normalizeRateText(input: string): string {
  return input.trim().replace(/,/g, ".");
}

/**
 * Parse a pay-per-second string the way Swift Decimal(string:locale: en_US_POSIX) does
 * for the values this app accepts: a positive plain decimal, not scientific notation.
 */
export function parseRate(input: string): Decimal | null {
  const normalized = normalizeRateText(input);
  if (!POSITIVE_DECIMAL.test(normalized)) {
    return null;
  }
  try {
    const value = new Decimal(normalized);
    if (!value.isFinite() || value.lte(0)) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function decimalFromNumber(value: number): Decimal {
  return new Decimal(value);
}
