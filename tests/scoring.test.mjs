import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIERS,
  tierForPoints,
  nextTier,
  pointsToNextTier,
  pointsForLevel,
  levelForPoints,
  levelProgress,
  assistMultiplier,
  speedMultiplier,
  pointsForSession,
  boardCompletionShare,
  colorForSeat,
  colorForPlayer,
  hueColor,
  PLAYER_COLORS,
  highlightsFromLog,
} from "../game/scoring.js";

test("tierForPoints picks the highest threshold not exceeding points", () => {
  assert.equal(tierForPoints(0).name, "Wood");
  assert.equal(tierForPoints(599).name, "Wood");
  assert.equal(tierForPoints(600).name, "Stone");
  assert.equal(tierForPoints(13999).name, "Porcelain");
  assert.equal(tierForPoints(14000).name, "Rosewood");
  assert.equal(tierForPoints(41999).name, "Cloisonné");
  assert.equal(tierForPoints(42000).name, "Lacquer");
  assert.equal(tierForPoints(99999).name, "Lacquer");
});

test("nextTier / pointsToNextTier agree with the reference thresholds", () => {
  assert.equal(nextTier(9140).name, "Rosewood");
  assert.equal(pointsToNextTier(9140), 4860);
  assert.equal(nextTier(42000), null);
  assert.equal(pointsToNextTier(42000), 0);
});

test("TIERS is sorted ascending by threshold", () => {
  for (let i = 1; i < TIERS.length; i++) assert.ok(TIERS[i].threshold > TIERS[i - 1].threshold);
});

test("overall level curve starts at zero, ramps gently, and remains unbounded", () => {
  assert.equal(levelForPoints(0), 0);
  assert.equal(levelForPoints(1799), 0);
  assert.equal(levelForPoints(1800), 1);
  assert.equal(levelForPoints(9140), 4);
  assert.equal(pointsForLevel(1), 1800);
  assert.equal(pointsForLevel(5), 9159);
  assert.equal(pointsForLevel(25), 51171);
  assert.equal(pointsForLevel(50), 118009);
  assert.equal(pointsForLevel(100), 305678);
  assert.deepEqual(levelProgress(9140), {
    level: 4,
    nextLevel: 5,
    nextLevelAt: 9159,
    pointsToNext: 19,
    progressPct: (9140 - pointsForLevel(4)) / (pointsForLevel(5) - pointsForLevel(4)) * 100,
  });
  assert.ok(levelForPoints(1000000) > 100);
});

test("assistMultiplier reduces credit per assist, floored", () => {
  assert.equal(assistMultiplier(0), 1);
  assert.ok(assistMultiplier(2) < 1);
  assert.ok(assistMultiplier(50) >= 0.5);
});

test("speedMultiplier rewards clearing faster than par and clamps the band", () => {
  const par = speedMultiplier(52 * 2500, 52);
  assert.ok(Math.abs(par - 1) < 0.01);
  const fast = speedMultiplier(52 * 1000, 52);
  assert.ok(fast > 1);
  const slow = speedMultiplier(52 * 10000, 52);
  assert.ok(slow < 1);
  assert.ok(slow >= 0.6);
});

test("pointsForSession is a positive integer that drops with assist usage", () => {
  const clean = pointsForSession({ pairsCleared: 26, assistsUsed: 0, elapsedMs: 26 * 2500, tileCount: 52 });
  const assisted = pointsForSession({ pairsCleared: 26, assistsUsed: 4, elapsedMs: 26 * 2500, tileCount: 52 });
  assert.ok(Number.isInteger(clean));
  assert.ok(clean > 0);
  assert.ok(assisted < clean);
});

test("boardCompletionShare is a percentage of the total pairs cleared", () => {
  assert.equal(boardCompletionShare(7, 26), 27);
  assert.equal(boardCompletionShare(0, 0), 0);
});

test("colorForSeat uses the fixed rotation for the first four seats", () => {
  assert.equal(colorForSeat(0), PLAYER_COLORS[0]);
  assert.equal(colorForSeat(3), PLAYER_COLORS[3]);
  assert.ok(colorForSeat(4).startsWith("oklch("));
  assert.notEqual(colorForSeat(4), colorForSeat(5));
});

test("colorForPlayer prefers a player's stored hue over seat position", () => {
  const users = { Dana: { hue: 155 } };
  assert.equal(colorForPlayer("Dana", 0, users), hueColor(155));
  assert.notEqual(colorForPlayer("Dana", 0, users), PLAYER_COLORS[0]);
});

test("colorForPlayer falls back to colorForSeat when no hue is stored", () => {
  assert.equal(colorForPlayer("Robin", 1, {}), colorForSeat(1));
  assert.equal(colorForPlayer("Robin", 1, undefined), colorForSeat(1));
  assert.equal(colorForPlayer("Robin", 1, { Robin: {} }), colorForSeat(1));
});

test("highlightsFromLog produces up to three competitive lines", () => {
  const players = { 0: { name: "You" }, 1: { name: "Dana" } };
  const log = [
    { seat: 1, assisted: false },
    { seat: 1, assisted: false },
    { seat: 1, assisted: false },
    { seat: 0, assisted: true },
  ];
  const lines = highlightsFromLog(log, players);
  assert.ok(lines.length > 0);
  assert.ok(lines.length <= 3);
  assert.ok(lines.some((l) => l.includes("Dana")));
});

test("highlightsFromLog handles an empty log", () => {
  assert.deepEqual(highlightsFromLog([], {}), []);
});

test("highlightsFromLog calls out the assist point penalty by name and percentage", () => {
  const players = { 0: { name: "You" } };
  const log = [{ seat: 0 }];
  const clean = highlightsFromLog(log, players, {});
  assert.ok(clean.some((l) => l === "Nobody used an assist this round."));
  const assisted = highlightsFromLog(log, players, { You: 2 });
  assert.ok(assisted.some((l) => l.includes("You") && l.includes("2 assists") && /-\d+%/.test(l)));
});
