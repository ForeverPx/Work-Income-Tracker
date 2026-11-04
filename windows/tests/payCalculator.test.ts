import assert from "node:assert/strict";
import test from "node:test";
import Decimal from "decimal.js";
import { PayCalculator } from "../src/domain/payCalculator";
import type { ScheduleWindow, WorkInterval } from "../src/domain/types";
import { assertMoney } from "./helpers";

test("unpaid overtime stops earnings but keeps working duration", () => {
  const start = new Date(0);
  const shiftEnd = new Date(start.getTime() + 9 * 3600 * 1000);
  const now = new Date(start.getTime() + 10 * 3600 * 1000);
  const session = makeSession(start, now, "1", shiftEnd, false);

  const summary = new PayCalculator().summary([session], now, window(start, now), false);

  assertMoney(summary.earned, 9 * 3600);
  assert.equal(summary.workedDuration, 10 * 3600);
  assert.equal(summary.unpaidDuration, 3600);
  assert.equal(summary.countdownDuration, 0);
});

test("paid overtime continues earnings and has no unpaid duration", () => {
  const start = new Date(0);
  const now = new Date(start.getTime() + 10 * 3600 * 1000);
  const session = makeSession(start, now, "1", new Date(start.getTime() + 9 * 3600 * 1000), true);

  const summary = new PayCalculator().summary([session], now, window(start, now), false);

  assertMoney(summary.earned, 10 * 3600);
  assert.equal(summary.unpaidDuration, 0);
});

test("rest gap is not counted across multiple sessions", () => {
  const start = new Date(0);
  const first = makeSession(start, new Date(start.getTime() + 3600 * 1000), "0.5", new Date(start.getTime() + 8 * 3600 * 1000), false);
  const second = makeSession(
    new Date(start.getTime() + 2 * 3600 * 1000),
    new Date(start.getTime() + 3 * 3600 * 1000),
    "0.5",
    new Date(start.getTime() + 8 * 3600 * 1000),
    false,
  );

  const summary = new PayCalculator().summary(
    [first, second],
    new Date(start.getTime() + 4 * 3600 * 1000),
    window(start, new Date(start.getTime() + 24 * 3600 * 1000)),
    false,
  );

  assert.equal(summary.workedDuration, 2 * 3600);
  assertMoney(summary.earned, 3600);
});

test("carried overtime stays unpaid until the next shift starts", () => {
  const midnight = new Date(0);
  const shiftStart = new Date(midnight.getTime() + 9 * 3600 * 1000);
  const now = new Date(shiftStart.getTime() + 60 * 1000);
  const session: WorkInterval = {
    startedAt: midnight,
    endedAt: null,
    ratePerSecond: new Decimal(1),
    shiftEndsAt: new Date(midnight.getTime() + 18 * 3600 * 1000),
    paidStartsAt: shiftStart,
    paysAfterWork: false,
  };

  const summary = new PayCalculator().summary(
    [session],
    now,
    window(midnight, new Date(midnight.getTime() + 24 * 3600 * 1000)),
    true,
  );

  assertMoney(summary.earned, 60);
  assert.equal(summary.workedDuration, 9 * 3600 + 60);
  assert.equal(summary.unpaidDuration, 9 * 3600);
  assert.equal(summary.isWorking, true);
});

function makeSession(
  start: Date,
  end: Date,
  rate: string,
  shiftEnd: Date,
  paysAfterWork: boolean,
): WorkInterval {
  return {
    startedAt: start,
    endedAt: end,
    ratePerSecond: new Decimal(rate),
    shiftEndsAt: shiftEnd,
    paidStartsAt: null,
    paysAfterWork,
  };
}

function window(start: Date, end: Date): ScheduleWindow {
  return {
    shiftStartsAt: start,
    shiftEndsAt: end,
    accountingStartsAt: start,
    accountingEndsAt: end,
  };
}
