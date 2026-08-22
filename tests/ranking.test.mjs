import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRankings, rankingMetricValue } from "../game/ranking.js";

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
  assert.equal(rankingMetricValue(rows[0], "speed"), 300);
  assert.equal(rankingMetricValue(rows[0], "share"), 60);
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
