import test from "node:test";
import assert from "node:assert/strict";
import { recordDailyMilestones, recordRaceMilestones } from "../worker/index.js";

// Minimal in-memory D1 stand-in covering just the statements
// recordDailyMilestones/recordRaceMilestones issue.
function createFakeDb({ users = [], dailyBoards = {} } = {}) {
  const registeredUsers = new Set(users);
  const userStats = new Map();
  const activityEvents = [];

  function statement(sql) {
    let values = [];
    return {
      bind(...v) { values = v; return this; },
      async first() {
        if (sql.includes("FROM daily_boards")) {
          const layoutId = dailyBoards[values[0]];
          return layoutId ? { layout_id: layoutId } : null;
        }
        if (sql.includes("daily_streak, daily_streak_date, best_streak, best_daily_ms, best_race_pairs FROM user_stats")) {
          return userStats.get(values[0]) || null;
        }
        if (sql.includes("SELECT best_race_pairs FROM user_stats")) {
          return userStats.get(values[0]) || null;
        }
        if (sql.includes("SELECT name FROM users")) {
          return registeredUsers.has(values[0]) ? { name: values[0] } : null;
        }
        throw new Error(`unhandled first(): ${sql}`);
      },
      async run() {
        if (sql.includes("INSERT INTO user_stats") && sql.includes("daily_streak")) {
          const [userName, dailyStreak, dailyStreakDate, bestStreak, bestDailyMs, bestDailyLayoutId, bestRacePairs, updatedAt] = values;
          userStats.set(userName, { daily_streak: dailyStreak, daily_streak_date: dailyStreakDate, best_streak: bestStreak, best_daily_ms: bestDailyMs, best_daily_layout_id: bestDailyLayoutId, best_race_pairs: bestRacePairs, updated_at: updatedAt });
          return { success: true };
        }
        if (sql.includes("INSERT INTO user_stats")) {
          const [userName, bestRacePairs, updatedAt] = values;
          userStats.set(userName, { ...(userStats.get(userName) || {}), best_race_pairs: bestRacePairs, updated_at: updatedAt });
          return { success: true };
        }
        if (sql.includes("INSERT INTO activity_events")) {
          const [userName, kind, value, layoutId, createdAt] = values;
          activityEvents.push({ userName, kind, value, layoutId, createdAt });
          return { success: true };
        }
        throw new Error(`unhandled run(): ${sql}`);
      },
    };
  }

  return { prepare: (sql) => statement(sql), _userStats: userStats, _activityEvents: activityEvents };
}

test("recordDailyMilestones extends a streak on a consecutive day and logs a new record", async () => {
  const db = createFakeDb({ dailyBoards: { "2026-08-20": "two-bridges", "2026-08-21": "dragons-nest" } });

  await recordDailyMilestones(db, { user: "Henning", date: "2026-08-20", elapsedMs: 90000 });
  assert.equal(db._userStats.get("Henning").daily_streak, 1);
  assert.equal(db._userStats.get("Henning").best_streak, 1);
  assert.deepEqual(db._activityEvents.map((e) => e.kind), ["daily_streak", "best_daily_time"]);

  db._activityEvents.length = 0;
  await recordDailyMilestones(db, { user: "Henning", date: "2026-08-21", elapsedMs: 120000 });
  assert.equal(db._userStats.get("Henning").daily_streak, 2);
  assert.equal(db._userStats.get("Henning").best_streak, 2);
  // Slower than the prior best time, so only the streak record fires.
  assert.deepEqual(db._activityEvents.map((e) => e.kind), ["daily_streak"]);
});

test("recordDailyMilestones resets the streak after a missed day and never regresses best_streak", async () => {
  const db = createFakeDb({ dailyBoards: { "2026-08-20": "two-bridges", "2026-08-23": "two-bridges" } });

  await recordDailyMilestones(db, { user: "Henning", date: "2026-08-20", elapsedMs: 90000 });
  assert.equal(db._userStats.get("Henning").best_streak, 1);

  db._activityEvents.length = 0;
  await recordDailyMilestones(db, { user: "Henning", date: "2026-08-23", elapsedMs: 90000 });
  assert.equal(db._userStats.get("Henning").daily_streak, 1);
  assert.equal(db._userStats.get("Henning").best_streak, 1);
  // Not a new streak record and not faster than the existing best time.
  assert.deepEqual(db._activityEvents, []);
});

test("recordRaceMilestones only fires for a registered player beating their own prior best", async () => {
  const db = createFakeDb({ users: ["Henning"] });
  const completedRoom = { mode: "race", layoutId: "two-bridges", state: { state: "completed" }, pairsCleared: { Henning: 12, Guest: 9 } };

  await recordRaceMilestones(db, completedRoom);
  assert.equal(db._userStats.get("Henning").best_race_pairs, 12);
  assert.equal(db._userStats.has("Guest"), false); // unregistered player skipped
  assert.equal(db._activityEvents.length, 1);
  assert.equal(db._activityEvents[0].kind, "best_race_pairs");
  assert.equal(db._activityEvents[0].value, 12);

  db._activityEvents.length = 0;
  await recordRaceMilestones(db, { ...completedRoom, pairsCleared: { Henning: 10 } });
  assert.equal(db._userStats.get("Henning").best_race_pairs, 12); // not beaten, unchanged
  assert.deepEqual(db._activityEvents, []);
});

test("recordRaceMilestones ignores non-race or non-completed rooms", async () => {
  const db = createFakeDb({ users: ["Henning"] });
  await recordRaceMilestones(db, { mode: "shared", state: { state: "completed" }, pairsCleared: { Henning: 20 } });
  await recordRaceMilestones(db, { mode: "race", state: { state: "in_progress" }, pairsCleared: { Henning: 20 } });
  assert.equal(db._userStats.size, 0);
  assert.deepEqual(db._activityEvents, []);
});
