import test from "node:test";
import assert from "node:assert/strict";
import { equippedFeltName, feltCssVars } from "../game/felts.js";
import { TIER_UNLOCKS } from "../game/scoring.js";

test("equippedFeltName uses the tier felt by default", () => {
  assert.equal(equippedFeltName(0, {}), "Wood");
  assert.equal(equippedFeltName(TIER_UNLOCKS.Bone.feltThreshold, {}), "Bone");
});

test("equippedFeltName honors unlocked selections and rejects locked ones", () => {
  assert.equal(equippedFeltName(TIER_UNLOCKS.Stone.feltThreshold, { felt: "Stone" }), "Stone");
  assert.equal(equippedFeltName(0, { felt: "Stone" }), "Wood");
  assert.equal(equippedFeltName(999999, { felt: "Unknown" }), "Lacquer");
});

test("feltCssVars returns the selected felt palette", () => {
  assert.match(feltCssVars("Stone"), /--felt-a:#1d5f6e/);
  assert.match(feltCssVars("Stone"), /--felt-c:#0a232b/);
});
