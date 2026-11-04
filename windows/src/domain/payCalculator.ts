import Decimal from "decimal.js";
import { parseRate } from "../shared/money";
import type { WorkInterval, WorkSession, WorkSummary, ScheduleWindow } from "./types";

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function secondsBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 1000;
}

/**
 * Port of WorkPrice/Domain/PayCalculator.swift.
 * Pay is interval math: paid seconds × the rate snapshotted on that interval.
 * Durations come from real start/end instants, never from timer tick counts.
 */
export class PayCalculator {
  summary(
    sessions: WorkInterval[],
    now: Date,
    window: ScheduleWindow,
    isWorking: boolean,
  ): WorkSummary {
    const result: WorkSummary = {
      earned: new Decimal(0),
      workedDuration: 0,
      unpaidDuration: 0,
      countdownDuration: Math.max(0, secondsBetween(now, window.shiftEndsAt)),
      isWorking,
    };

    for (const session of sessions) {
      const sessionEnd = minDate(session.endedAt ?? now, now);
      const start = maxDate(session.startedAt, window.accountingStartsAt);
      const end = minDate(sessionEnd, window.accountingEndsAt);
      if (end.getTime() <= start.getTime()) {
        continue;
      }

      const worked = secondsBetween(start, end);
      result.workedDuration += worked;

      let paidDuration: number;
      if (session.paysAfterWork) {
        paidDuration = worked;
      } else {
        const paidStart = maxDate(start, session.paidStartsAt ?? start);
        const paidEnd = minDate(end, session.shiftEndsAt);
        paidDuration = Math.max(0, secondsBetween(paidStart, paidEnd));
        result.unpaidDuration += worked - paidDuration;
      }

      result.earned = result.earned.plus(new Decimal(paidDuration).mul(session.ratePerSecond));
    }

    return result;
  }
}

export function sessionInterval(session: WorkSession): WorkInterval {
  return {
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    ratePerSecond: parseRate(session.ratePerSecondText) ?? new Decimal(0),
    shiftEndsAt: session.shiftEndsAt,
    paidStartsAt: session.paidStartsAt,
    paysAfterWork: session.paysAfterWork,
  };
}
