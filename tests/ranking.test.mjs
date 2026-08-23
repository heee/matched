import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRankings, rankingMetricValue, roomElapsedSeconds, topRegisteredRankings } from "../game/ranking.js";

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

test("shared board timing excludes time spent waiting before the first match", () => {
  assert.equal(roomElapsedSeconds({
    mode: "shared",
    startedAt: "2026-08-22T08:00:00.000Z",
    completedAt: "2026-08-22T18:05:00.000Z",
    elapsedMs: 36300000,
    state: { matchLog: [
      { user: "A", at: "2026-08-22T18:00:00.000Z" },
      { user: "B", at: "2026-08-22T18:05:00.000Z" },
    ] },
  }), 300);
});

test("legacy race timing repairs hours of invite waiting without discarding valid setup time", () => {
  const room = {
    mode: "race",
    completedAt: "2026-08-22T18:05:00.000Z",
    state: { matchLog: [{ user: "A", at: "2026-08-22T18:02:30.000Z" }] },
  };
  assert.equal(roomElapsedSeconds({ ...room, elapsedMs: 20300000 }), 150);
  assert.equal(roomElapsedSeconds({ ...room, elapsedMs: 210000 }), 210);
});

test("legacy completed rooms without a real start remain untimed", () => {
  assert.equal(roomElapsedSeconds({
    createdAt: "2026-08-22T17:57:26.000Z",
    completedAt: "2026-08-22T18:00:00.000Z",
  }), null);
});

test("home group ranking includes registered non-players and limits to three", () => {
  const users = { A: {}, B: {}, C: {}, D: {} };
  const rooms = {
    one: {
      completedAt: "2026-08-22T18:00:00.000Z",
      startedAt: "2026-08-22T17:58:00.000Z",
      tileCount: 20,
      players: ["A", "B"],
      pairsCleared: { A: 7, B: 3 },
    },
  };
  const rows = topRegisteredRankings(rooms, users, "Today", "pairs", 3, NOW);
  assert.deepEqual(rows.map((row) => [row.name, row.value]), [["A", 7], ["B", 3], ["C", 0]]);
});

test("home group ranking includes registered humans known through ranking history", () => {
  const rooms = {
    one: { completedAt: NOW, tileCount: 4, players: ["Remote"], pairsCleared: { Remote: 2 } },
  };
  assert.deepEqual(topRegisteredRankings(rooms, { Local: {} }, "Today", "pairs", 3, NOW).map((row) => row.name), ["Remote", "Local"]);
});

test("home speed ranking puts players without a timed board last", () => {
  const users = { A: {}, B: {}, C: {} };
  const rooms = {
    slower: { completedAt: NOW, elapsedMs: 180000, tileCount: 4, players: ["A"], pairsCleared: { A: 2 } },
    faster: { completedAt: NOW, elapsedMs: 90000, tileCount: 4, players: ["B"], pairsCleared: { B: 2 } },
  };
  assert.deepEqual(topRegisteredRankings(rooms, users, "Today", "speed", 3, NOW).map((row) => row.name), ["B", "A", "C"]);
});
