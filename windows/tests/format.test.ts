import assert from "node:assert/strict";
import test from "node:test";
import Decimal from "decimal.js";
import { formatClock, formatHourlyRate, formatMoney, formatShortDuration, scheduleHint } from "../src/shared/format";

test("money rounds half up to two decimal places", () => {
  assert.equal(formatMoney(new Decimal("1.005")), "1.01");
  assert.equal(formatMoney(new Decimal("0")), "0.00");
  assert.equal(formatMoney(new Decimal("1320.5")), "1,320.50");
});

test("default rate converts to the macOS hourly reference", () => {
  assert.equal(formatHourlyRate("0.0367"), "132.12");
  assert.equal(formatHourlyRate("abc"), null);
  assert.equal(formatHourlyRate("0"), null);
});

test("durations match the floating dashboard formats", () => {
  assert.equal(formatClock(0), "00:00:00");
  assert.equal(formatClock(59.9), "00:00:59");
  assert.equal(formatClock(8 * 3600 + 5), "08:00:05");
  assert.equal(formatShortDuration(3661), "1h 01m 01s");
});

test("schedule hints match the settings copy", () => {
  assert.equal(scheduleHint(22 * 60, 6 * 60, false), "当前为跨午夜班次，账目归入班次开始日。");
  assert.equal(scheduleHint(9 * 60, 9 * 60, false), "上班时间和下班时间不能相同。");
  assert.equal(scheduleHint(9 * 60, 18 * 60, true), "下班后仍会继续计薪。");
  assert.equal(scheduleHint(9 * 60, 18 * 60, false), "下班后金额停止增长，并累计无偿打工时长。");
});
