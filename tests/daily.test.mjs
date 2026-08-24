import test from "node:test";
import assert from "node:assert/strict";
import { todayDateStr, msUntilNextReset } from "../game/daily.js";
import { isPlausibleDailyDate } from "../worker/index.js";

test("todayDateStr uses the local calendar date, not UTC", () => {
  // 11pm local on the 22nd is still the 22nd locally, even though UTC (for
  // any zone behind UTC) may have already rolled to the 23rd.
  assert.equal(todayDateStr(new Date(2026, 7, 22, 23, 30)), "2026-08-22");
  assert.equal(todayDateStr(new Date(2026, 0, 5, 0, 5)), "2026-01-05");
});

test("msUntilNextReset counts down to local midnight", () => {
  const oneMinuteToMidnight = new Date(2026, 7, 22, 23, 59);
  assert.equal(msUntilNextReset(oneMinuteToMidnight), 60_000);
});

test("isPlausibleDailyDate accepts any timezone's local date within a day of UTC", () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(isPlausibleDailyDate(today), true);
  assert.equal(isPlausibleDailyDate("not-a-date"), false);
  assert.equal(isPlausibleDailyDate("2020-01-01"), false); // far in the past
  assert.equal(isPlausibleDailyDate(null), false);
});
