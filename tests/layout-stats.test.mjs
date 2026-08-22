import test from "node:test";
import assert from "node:assert/strict";
import { completedLayoutStats } from "../game/layout-stats.js";

test("layout stats count completed boards and the active user's pairs", () => {
  const stats = completedLayoutStats({
    one: { completedAt: "2026-08-20T12:00:00Z", layoutId: "two-bridges", players: ["A", "B"], pairsCleared: { A: 8, B: 10 } },
    two: { completedAt: "2026-08-21T12:00:00Z", layoutId: "two-bridges", players: ["A"], pairsCleared: { A: 18 } },
    three: { completedAt: "2026-08-22T12:00:00Z", layoutId: "dragons-nest", players: ["A"], pairsCleared: { A: 26 } },
    unfinished: { completedAt: null, layoutId: "two-bridges", players: ["A"], pairsCleared: { A: 4 } },
    other: { completedAt: "2026-08-22T12:00:00Z", layoutId: "two-bridges", players: ["B"], pairsCleared: { B: 18 } },
  }, "A", { since: 0 });

  assert.deepEqual(stats, {
    "two-bridges": { boards: 2, pairs: 26 },
    "dragons-nest": { boards: 1, pairs: 26 },
  });
});

test("layout stats are empty when the user has no completed boards", () => {
  assert.deepEqual(completedLayoutStats({}, "A"), {});
});

test("layout stats ignore completions before the progression launch", () => {
  const stats = completedLayoutStats({
    old: { completedAt: "2026-08-22T18:53:19.161Z", layoutId: "two-bridges", players: ["A"] },
    new: { completedAt: "2026-08-22T18:53:19.162Z", layoutId: "two-bridges", players: ["A", "B"] },
  }, "A");
  assert.equal(stats["two-bridges"].boards, 1);
});
