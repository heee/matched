import { test } from "node:test";
import assert from "node:assert/strict";
import { MATERIALS, materialFor, materialCssVars, inkOverrideFor, equippedMaterialName } from "../game/materials.js";
import { TIERS, TIER_UNLOCKS } from "../game/scoring.js";

test("every tier material has a palette entry", () => {
  for (const tier of TIERS) {
    assert.ok(MATERIALS[tier.material], `missing palette for ${tier.material}`);
  }
});

test("materialFor falls back to Bone for an unknown name", () => {
  assert.equal(materialFor("Adamantium"), MATERIALS.Bone);
  assert.equal(materialFor(undefined), MATERIALS.Bone);
});

test("materialCssVars emits every custom property .tile reads", () => {
  const vars = materialCssVars("Jade");
  for (const key of ["--tile-a", "--tile-b", "--tile-edge", "--tile-upper"]) {
    assert.ok(vars.includes(`${key}:`), `missing ${key}`);
  }
  assert.ok(vars.includes(MATERIALS.Jade.a));
});

test("only dark materials override the face ink", () => {
  assert.equal(inkOverrideFor("Bone"), null);
  assert.equal(inkOverrideFor("Jade"), null);
  assert.equal(inkOverrideFor("Lacquer"), MATERIALS.Lacquer.ink);
  assert.equal(inkOverrideFor("Rosewood"), MATERIALS.Rosewood.ink);
});

test("equippedMaterialName falls back to the tier default when nothing is picked", () => {
  assert.equal(equippedMaterialName(0, undefined), "Wood");
  assert.equal(equippedMaterialName(0, {}), "Wood");
  assert.equal(equippedMaterialName(TIER_UNLOCKS.Bone.materialThreshold, {}), "Bone");
});

test("equippedMaterialName honors an unlocked pick but refuses a locked one", () => {
  const lacquerPoints = TIER_UNLOCKS.Lacquer.materialThreshold;
  assert.equal(equippedMaterialName(lacquerPoints, { material: "Lacquer" }), "Lacquer");
  // Picked Lacquer but nowhere near affording it — falls back rather than
  // handing out a tier the player has not earned.
  assert.notEqual(equippedMaterialName(0, { material: "Lacquer" }), "Lacquer");
  assert.equal(equippedMaterialName(0, { material: "Lacquer" }), "Wood");
});

test("equippedMaterialName ignores a material that no longer exists", () => {
  assert.equal(equippedMaterialName(0, { material: "Adamantium" }), "Wood");
});
