import Decimal from "decimal.js";

/** Port of WorkPrice/Models/AppSettings.swift defaults and fields. */
export interface AppSettings {
  id: string;
  ratePerSecondText: string;
  workStartMinutes: number;
  workEndMinutes: number;
  paysAfterWork: boolean;
}

export function defaultSettings(): AppSettings {
  return {
    id: "singleton",
    ratePerSecondText: "0.0367",
    workStartMinutes: 9 * 60,
    workEndMinutes: 18 * 60,
    paysAfterWork: false,
  };
}

/** Port of WorkPrice/Models/WorkSession.swift. Dates are absolute instants. */
export interface WorkSession {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  ratePerSecondText: string;
  shiftEndsAt: Date;
  paidStartsAt: Date | null;
  accountingStartsAt: Date;
  accountingEndsAt: Date;
  paysAfterWork: boolean;
}

/** Port of WorkInterval in PayCalculator.swift. */
export interface WorkInterval {
  startedAt: Date;
  endedAt: Date | null;
  ratePerSecond: Decimal;
  shiftEndsAt: Date;
  paidStartsAt: Date | null;
  paysAfterWork: boolean;
}

/** Port of ScheduleWindow in ScheduleResolver.swift. */
export interface ScheduleWindow {
  shiftStartsAt: Date;
  shiftEndsAt: Date;
  accountingStartsAt: Date;
  accountingEndsAt: Date;
}

/** Port of WorkSummary in PayCalculator.swift. `earned` keeps full decimal precision. */
export interface WorkSummary {
  earned: Decimal;
  workedDuration: number;
  unpaidDuration: number;
  countdownDuration: number;
  isWorking: boolean;
}
