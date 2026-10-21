import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import test from "node:test";
import { DateTime } from "luxon";
import { WorkStateStore } from "../src/state/workStateStore";
import { FilePersistence, MemoryPersistence } from "../src/state/persistence";
import { assertMoney, assertSameInstant, utcDate } from "./helpers";

test("toggle creates and closes a session", () => {
  const persistence = new MemoryPersistence();
  const start = new Date(1_700_000_000 * 1000);
  const store = new WorkStateStore({ persistence, now: start, timeZone: "UTC" });

  store.toggleWorking(start);
  assert.equal(store.isWorking, true);

  const end = new Date(start.getTime() + 125 * 1000);
  store.toggleWorking(end);
  assert.equal(store.isWorking, false);
  assert.equal(store.sessions.length, 1);
  assertSameInstant(store.sessions[0].endedAt, end);
});

test("changing settings while working splits the rate snapshot", () => {
  const start = new Date(1_700_000_000 * 1000);
  const store = new WorkStateStore({
    persistence: new MemoryPersistence(),
    now: start,
    timeZone: "UTC",
  });
  store.toggleWorking(start);
  store.tick(new Date(start.getTime() + 60 * 1000));

  assert.equal(
    store.applySettings("1.25", 9 * 60, 18 * 60, true),
    true,
  );

  assert.equal(store.sessions.length, 2);
  assert.notEqual(store.sessions[0].endedAt, null);
  assert.equal(store.sessions[0].ratePerSecondText, "0.0367");
  assert.equal(store.sessions[1].ratePerSecondText, "1.25");
  assert.equal(store.sessions[1].endedAt, null);
  assert.equal(store.sessions[1].paysAfterWork, true);
});

test("an open session is recovered by a new store", () => {
  const persistence = new MemoryPersistence();
  const start = new Date(1_700_000_000 * 1000);
  const first = new WorkStateStore({ persistence, now: start, timeZone: "UTC" });
  first.toggleWorking(start);

  const restored = new WorkStateStore({
    persistence,
    now: new Date(start.getTime() + 60 * 1000),
    timeZone: "UTC",
  });

  assert.equal(restored.isWorking, true);
  assert.equal(restored.sessions.length, 1);
  assert.ok(Math.abs(restored.summary.workedDuration - 60) < 0.001);
});

test("an active session rolls at the accounting boundary", () => {
  const start = utcDate(2026, 8, 11, 23, 59);
  const midnight = DateTime.fromJSDate(start, { zone: "UTC" }).plus({ minutes: 1 }).toJSDate();
  const now = DateTime.fromJSDate(midnight, { zone: "UTC" }).plus({ minutes: 1 }).toJSDate();
  const paidStart = DateTime.fromJSDate(midnight, { zone: "UTC" }).plus({ hours: 9 }).toJSDate();
  const store = new WorkStateStore({
    persistence: new MemoryPersistence(),
    now: start,
    timeZone: "UTC",
  });

  store.toggleWorking(start);
  store.tick(now);

  assert.equal(store.sessions.length, 2);
  assertSameInstant(store.sessions[0].endedAt, midnight);
  assertSameInstant(store.sessions[1].startedAt, midnight);
  assertSameInstant(store.sessions[1].paidStartsAt, paidStart);
  assert.equal(store.sessions[1].endedAt, null);
  assert.ok(Math.abs(store.summary.workedDuration - 60) < 0.001);
  assert.ok(Math.abs(store.summary.unpaidDuration - 60) < 0.001);
  assertMoney(store.summary.earned, 0);

  assert.equal(store.applySettings("0.05", 9 * 60, 18 * 60, false), true);
  assert.equal(store.sessions.length, 3);
  assertSameInstant(store.sessions[2].paidStartsAt, paidStart);
});

test("invalid settings are rejected without changing stored values", () => {
  const store = new WorkStateStore({
    persistence: new MemoryPersistence(),
    timeZone: "UTC",
  });
  const originalRate = store.settings.ratePerSecondText;

  assert.equal(store.applySettings("abc", 9 * 60, 18 * 60, false), false);
  assert.equal(store.settings.ratePerSecondText, originalRate);
  assert.equal(store.lastError, "秒薪必须是大于 0 的数字。");
});

test("equal shift times are rejected and a comma decimal is accepted", () => {
  const start = new Date(1_700_000_000 * 1000);
  const store = new WorkStateStore({
    persistence: new MemoryPersistence(),
    now: start,
    timeZone: "UTC",
  });

  assert.equal(store.applySettings("1.5", 9 * 60, 9 * 60, false), false);
  assert.equal(store.lastError, "上班时间和下班时间必须不同。");
  assert.equal(store.settings.ratePerSecondText, "0.0367");

  assert.equal(store.applySettings("1,25", 9 * 60, 18 * 60, false), true);
  assert.equal(store.settings.ratePerSecondText, "1.25");
  assert.equal(store.lastError, null);
});

test("restart recovery round-trips through a local file", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workprice-"));
  const filePath = path.join(directory, "workprice-data.json");
  const persistence = new FilePersistence(filePath);
  const start = utcDate(2026, 8, 11, 10, 0);
  const first = new WorkStateStore({ persistence, now: start, timeZone: "UTC" });
  first.toggleWorking(start);

  const restored = new WorkStateStore({
    persistence: new FilePersistence(filePath),
    now: new Date(start.getTime() + 90 * 1000),
    timeZone: "UTC",
  });

  assert.equal(restored.isWorking, true);
  assert.equal(restored.settings.ratePerSecondText, "0.0367");
  assert.ok(Math.abs(restored.summary.workedDuration - 90) < 0.001);
  assert.equal(restored.persistenceWarning, null);
});

test("a corrupt data file is left untouched and the app runs in memory", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workprice-"));
  const filePath = path.join(directory, "workprice-data.json");
  fs.writeFileSync(filePath, "{ this is not json", "utf8");

  const store = new WorkStateStore({
    persistence: new FilePersistence(filePath),
    timeZone: "UTC",
  });

  assert.match(store.persistenceWarning ?? "", /本地数据无法打开/);
  assert.equal(store.isWorking, false);
  store.toggleWorking(utcDate(2026, 8, 11, 11, 0));
  assert.equal(store.isWorking, true);
  assert.equal(fs.readFileSync(filePath, "utf8"), "{ this is not json");
});
