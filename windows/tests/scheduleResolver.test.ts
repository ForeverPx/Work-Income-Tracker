import assert from "node:assert/strict";
import test from "node:test";
import { DateTime } from "luxon";
import { ScheduleResolver } from "../src/domain/scheduleResolver";
import { utcDate } from "./helpers";

test("same-day schedule uses the calendar day for accounting", () => {
  const resolver = new ScheduleResolver("UTC");
  const now = utcDate(2026, 8, 11, 12, 0);
  const window = resolver.window(now, 9 * 60, 18 * 60);

  assert.equal(window.shiftStartsAt.getTime(), utcDate(2026, 8, 11, 9, 0).getTime());
  assert.equal(window.shiftEndsAt.getTime(), utcDate(2026, 8, 11, 18, 0).getTime());
  assert.equal(window.accountingStartsAt.getTime(), utcDate(2026, 8, 11, 0, 0).getTime());
  assert.equal(window.accountingEndsAt.getTime(), utcDate(2026, 8, 12, 0, 0).getTime());
});

test("cross-midnight schedule keeps the previous shift during the daytime gap", () => {
  const resolver = new ScheduleResolver("UTC");
  const beforeEnd = resolver.window(utcDate(2026, 8, 12, 2, 0), 22 * 60, 6 * 60);
  const afterEnd = resolver.window(utcDate(2026, 8, 12, 12, 0), 22 * 60, 6 * 60);

  assert.equal(beforeEnd.shiftStartsAt.getTime(), utcDate(2026, 8, 11, 22, 0).getTime());
  assert.equal(beforeEnd.shiftEndsAt.getTime(), utcDate(2026, 8, 12, 6, 0).getTime());
  assert.equal(afterEnd.shiftStartsAt.getTime(), beforeEnd.shiftStartsAt.getTime());
  assert.equal(afterEnd.shiftEndsAt.getTime(), beforeEnd.shiftEndsAt.getTime());
  assert.equal(afterEnd.accountingStartsAt.getTime(), beforeEnd.accountingStartsAt.getTime());
  assert.equal(afterEnd.accountingEndsAt.getTime(), beforeEnd.accountingEndsAt.getTime());
  assert.equal(afterEnd.accountingEndsAt.getTime(), utcDate(2026, 8, 12, 22, 0).getTime());
});

test("cross-midnight schedule rolls at the next start", () => {
  const resolver = new ScheduleResolver("UTC");
  const window = resolver.window(utcDate(2026, 8, 12, 22, 0), 22 * 60, 6 * 60);

  assert.equal(window.shiftStartsAt.getTime(), utcDate(2026, 8, 12, 22, 0).getTime());
  assert.equal(window.shiftEndsAt.getTime(), utcDate(2026, 8, 13, 6, 0).getTime());
});

test("schedule uses local clock time across a daylight-saving change", () => {
  const zone = "Europe/Berlin";
  const now = DateTime.fromObject({ year: 2026, month: 3, day: 29, hour: 12 }, { zone }).toJSDate();
  const window = new ScheduleResolver(zone).window(now, 9 * 60, 18 * 60);

  assert.equal(DateTime.fromJSDate(window.shiftStartsAt, { zone }).hour, 9);
  assert.equal(DateTime.fromJSDate(window.shiftEndsAt, { zone }).hour, 18);
});
