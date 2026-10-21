import { DateTime } from "luxon";
import Decimal from "decimal.js";
import { parseRate } from "./money";

const WEEKDAYS = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** Half-up to 2 decimal places, with grouping separators. */
export function formatMoney(value: Decimal): string {
  const fixed = value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const negative = fixed.startsWith("-");
  const [whole, fraction] = (negative ? fixed.slice(1) : fixed).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${fraction}`;
}

export function formatHourlyRate(rateText: string): string | null {
  const rate = parseRate(rateText);
  if (!rate) {
    return null;
  }
  return formatMoney(rate.mul(3600));
}

/** Countdown clock. Hours are total hours and are not wrapped at 24. */
export function formatClock(durationSeconds: number): string {
  const seconds = Math.max(0, Math.floor(durationSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  return [hours, minutes, remain].map((part) => String(part).padStart(2, "0")).join(":");
}

/** Matches FloatingDashboardView.shortDuration: `1h 02m 03s`. */
export function formatShortDuration(durationSeconds: number): string {
  const seconds = Math.max(0, Math.floor(durationSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(remain).padStart(2, "0")}s`;
}

/** `yyyy/MM/dd EEE` with the same weekday words as zh_CN. */
export function formatDateLabel(date: Date, timeZone: string): string {
  const local = DateTime.fromJSDate(date, { zone: timeZone });
  const weekday = WEEKDAYS[local.weekday] ?? "";
  return `${local.toFormat("yyyy/MM/dd")} ${weekday}`;
}

export function minutesToTimeValue(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function timeValueToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

export function scheduleHint(
  startMinutes: number,
  endMinutes: number,
  paysAfterWork: boolean,
): string {
  if (startMinutes > endMinutes) {
    return "当前为跨午夜班次，账目归入班次开始日。";
  }
  if (startMinutes === endMinutes) {
    return "上班时间和下班时间不能相同。";
  }
  return paysAfterWork
    ? "下班后仍会继续计薪。"
    : "下班后金额停止增长，并累计无偿打工时长。";
}
