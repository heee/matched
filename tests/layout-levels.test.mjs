import test from "node:test";
import assert from "node:assert/strict";
import {
  gamesForLayoutLevel,
  layoutLevelForGames,
  layoutLevelProgress,
  MAX_LAYOUT_LEVEL,
} from "../game/layout-levels.js";

test("layout level curve starts at five and reaches 1,000", () => {
  assert.equal(gamesForLayoutLevel(1), 5);
  assert.equal(gamesForLayoutLevel(100), 1000);
});

test("games required per level rise gradually and never fall", () => {
  let previousStep = 0;
  for (let level = 1; level <= MAX_LAYOUT_LEVEL; level += 1) {
    const step = gamesForLayoutLevel(level) - gamesForLayoutLevel(level - 1);
    assert.ok(step >= previousStep, `Level ${level} step ${step} fell below ${previousStep}`);
    previousStep = step;
  }
  assert.ok(previousStep >= 14 && previousStep <= 15);
});

test("a touched layout is Level 0 until its fifth completion", () => {
  assert.equal(layoutLevelForGames(1), 0);
  assert.deepEqual(layoutLevelProgress(1), { level: 0, progress: 0.2, remaining: 4 });
  assert.equal(layoutLevelForGames(4), 0);
  assert.equal(layoutLevelForGames(5), 1);
});

test("Level 100 is capped and complete", () => {
  assert.deepEqual(layoutLevelProgress(1000), { level: 100, progress: 1, remaining: 0 });
  assert.deepEqual(layoutLevelProgress(5000), { level: 100, progress: 1, remaining: 0 });
});
