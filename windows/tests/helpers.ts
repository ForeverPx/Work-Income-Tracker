import { DateTime } from "luxon";
import Decimal from "decimal.js";

export function utcDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const value = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone: "UTC" },
  );
  if (!value.isValid) {
    throw new Error(value.invalidReason ?? "invalid date");
  }
  return value.toJSDate();
}

export function assertSameInstant(actual: Date | null | undefined, expected: Date): void {
  if (!actual) {
    throw new Error(`expected ${expected.toISOString()} but got ${String(actual)}`);
  }
  if (actual.getTime() !== expected.getTime()) {
    throw new Error(`expected ${expected.toISOString()} but got ${actual.toISOString()}`);
  }
}

export function assertMoney(actual: Decimal, expected: Decimal.Value): void {
  const target = new Decimal(expected);
  if (!actual.equals(target)) {
    throw new Error(`expected money ${target.toFixed()} but got ${actual.toFixed()}`);
  }
}
