import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRankings, rankingMetricValue, roomElapsedSeconds } from "../game/ranking.js";

const NOW = Date.parse("2026-08-22T18:00:00.000Z");

test("weekly rankings include completed rooms and exclude bots", () => {
  const rows = aggregateRankings({
    one: {
      completedAt: "2026-08-20T18:00:00.000Z",
      startedAt: Date.parse("2026-08-20T17:55:00.000Z"),
      tileCount: 40,
      players: ["Henning", "Bot Birch"],
      botNames: ["Bot Birch"],
      pairsCleared: { Henning: 12, "Bot Birch": 8 },
    },
  }, "Week", NOW);

  assert.deepEqual(rows.map((row) => row.name), ["Henning"]);
  assert.equal(rows[0].pairs, 12);
  assert.equal(rankingMetricValue(rows[0], "boards"), 1);
  assert.equal(rankingMetricValue(rows[0], "speed"), 300);
  assert.equal(rankingMetricValue(rows[0], "share"), 60);
});

test("pairs from an unfinished board appear immediately without adding a completed board", () => {
  const rows = aggregateRankings({
    active: {
      startedAt: "2026-08-22T17:00:00.000Z",
      tileCount: 52,
      players: ["A"],
      pairsCleared: { A: 10 },
      state: { matchLog: Array.from({ length: 10 }, (_, i) => ({ user: "A", at: NOW - i * 1000 })) },
    },
  }, "Week", NOW);

  assert.equal(rows[0].pairs, 10);
  assert.equal(rankingMetricValue(rows[0], "boards"), 0);
});

test("pair ranking respects individual match times on an unfinished board", () => {
  const rows = aggregateRankings({
    active: {
      startedAt: "2026-07-01T17:00:00.000Z",
      tileCount: 52,
      players: ["A"],
      pairsCleared: { A: 2 },
      state: { matchLog: [
        { user: "A", at: NOW - 8 * 86400000 },
        { user: "A", at: NOW - 1000 },
      ] },
    },
  }, "Week", NOW);

  assert.equal(rows[0].pairs, 1);
});

test("untimed boards do not dilute the speed average", () => {
  const rows = aggregateRankings({
    timed: { completedAt: "2026-08-22T18:00:00.000Z", startedAt: "2026-08-22T17:58:00.000Z", tileCount: 4, players: ["A"], pairsCleared: { A: 2 } },
    untimed: { completedAt: "2026-08-22T18:00:00.000Z", tileCount: 4, players: ["A"], pairsCleared: { A: 2 } },
  }, "Week", NOW);

  assert.equal(rows[0].boards, 2);
  assert.equal(rows[0].timedBoards, 1);
  assert.equal(rankingMetricValue(rows[0], "speed"), 120);
});

test("persisted elapsed duration keeps a completed session timed without startedAt", () => {
  const rows = aggregateRankings({
    completed: {
      completedAt: "2026-08-22T18:00:00.000Z",
      elapsedMs: 154000,
      tileCount: 4,
      players: ["A"],
      pairsCleared: { A: 2 },
    },
  }, "Week", NOW);

  assert.equal(rows[0].timedBoards, 1);
  assert.equal(rankingMetricValue(rows[0], "speed"), 154);
});

test("explicit elapsed duration wins over inconsistent stored timestamps", () => {
  assert.equal(roomElapsedSeconds({
    startedAt: "2026-08-22T18:01:00.000Z",
    completedAt: "2026-08-22T18:00:00.000Z",
    elapsedMs: 90000,
  }), 90);
});

test("legacy completed rooms without a real start remain untimed", () => {
  assert.equal(roomElapsedSeconds({
    createdAt: "2026-08-22T17:57:26.000Z",
    completedAt: "2026-08-22T18:00:00.000Z",
  }), null);
});
