import test from "node:test";
import assert from "node:assert/strict";
import { headToHeadStats } from "../game/head-to-head.js";

const NOW = Date.parse("2026-08-22T18:00:00Z");

test("head-to-head compares player totals and direct completed-board record", () => {
  const rooms = {
    together: {
      completedAt: "2026-08-22T17:00:00Z", tileCount: 40, players: ["A", "B"], botNames: [],
      pairsCleared: { A: 12, B: 8 }, peakStreaks: { A: 4, B: 2 }, state: { matchLog: [] },
    },
    tie: {
      completedAt: "2026-08-21T17:00:00Z", tileCount: 40, players: ["A", "B"], botNames: [],
      pairsCleared: { A: 10, B: 10 }, peakStreaks: { A: 3, B: 5 }, state: { matchLog: [] },
    },
    solo: {
      completedAt: "2026-08-20T17:00:00Z", tileCount: 36, players: ["B"], botNames: [],
      pairsCleared: { B: 18 }, peakStreaks: { B: 6 }, state: { matchLog: [] },
    },
  };
  const stats = headToHeadStats(rooms, "A", "B", "Week", NOW);
  assert.deepEqual(stats.together, { boards: 2, currentWins: 1, opponentWins: 0, ties: 1 });
  assert.deepEqual(stats.players[0], { name: "A", boards: 2, pairs: 22, share: 55, bestStreak: 4 });
  assert.deepEqual(stats.players[1], { name: "B", boards: 3, pairs: 36, share: 63, bestStreak: 6 });
});

test("head-to-head respects the selected period", () => {
  const old = { completedAt: "2026-07-01T12:00:00Z", tileCount: 4, players: ["A", "B"], pairsCleared: { A: 2, B: 0 }, state: { matchLog: [] } };
  assert.equal(headToHeadStats({ old }, "A", "B", "Week", NOW).together.boards, 0);
  assert.equal(headToHeadStats({ old }, "A", "B", "All time", NOW).together.boards, 1);
});
