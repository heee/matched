import test from "node:test";
import assert from "node:assert/strict";
import { completedDayStats, completedWeekStats, localDayBounds } from "../game/daily-stats.js";

test("day bounds follow the local calendar rather than a rolling 24-hour window", () => {
  const now = new Date(2026, 7, 22, 15, 30);
  const { startMs, endMs } = localDayBounds(now);
  assert.equal(new Date(startMs).getHours(), 0);
  assert.equal(new Date(startMs).getDate(), 22);
  assert.equal(new Date(endMs).getDate(), 23);
});

test("daily overview aggregates only the active user's boards completed today", () => {
  const now = new Date(2026, 7, 22, 15, 30);
  const today = new Date(2026, 7, 22, 10, 0).toISOString();
  const yesterday = new Date(2026, 7, 21, 23, 59).toISOString();
  const stats = completedDayStats({
    first: { completedAt: today, elapsedMs: 120000, players: ["Henning", "Dana"], pairsCleared: { Henning: 7 }, peakStreaks: { Henning: 3 } },
    second: { completedAt: today, elapsedMs: 180000, players: ["Henning"], pairsCleared: { Henning: 12 }, streaks: { Henning: 4 } },
    old: { completedAt: yesterday, elapsedMs: 60000, players: ["Henning"], pairsCleared: { Henning: 20 }, peakStreaks: { Henning: 8 } },
    other: { completedAt: today, elapsedMs: 90000, players: ["Dana"], pairsCleared: { Dana: 9 } },
    active: { completedAt: null, players: ["Henning"], pairsCleared: { Henning: 5 } },
  }, "Henning", now);

  assert.deepEqual(stats, { boards: 2, pairs: 19, bestStreak: 4, avgTimeS: 150 });
});

test("daily overview uses a dash-ready null when no completed board has timing data", () => {
  const now = new Date(2026, 7, 22, 15, 30);
  const today = new Date(2026, 7, 22, 10, 0).toISOString();
  assert.equal(completedDayStats({ one: { completedAt: today, players: ["A"], pairsCleared: { A: 2 } } }, "A", now).avgTimeS, null);
});

test("weekly overview returns seven local days oldest-first", () => {
  const now = new Date(2026, 7, 22, 15, 30);
  const rooms = {
    sixDaysAgo: { completedAt: new Date(2026, 7, 16, 10, 0).toISOString(), players: ["A"], pairsCleared: { A: 3 } },
    yesterday: { completedAt: new Date(2026, 7, 21, 10, 0).toISOString(), players: ["A"], pairsCleared: { A: 8 } },
    today: { completedAt: new Date(2026, 7, 22, 10, 0).toISOString(), players: ["A"], pairsCleared: { A: 20 } },
  };
  const week = completedWeekStats(rooms, "A", now);
  assert.equal(week.length, 7);
  assert.deepEqual(week.map((day) => day.pairs), [3, 0, 0, 0, 0, 8, 20]);
  assert.equal(week[0].date.getDate(), 16);
  assert.equal(week[6].date.getDate(), 22);
});
