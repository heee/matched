import { test } from "node:test";
import assert from "node:assert/strict";
import { MATERIALS, materialFor, materialCssVars, inkOverrideFor, equippedMaterialName, soundMaterialFor } from "../game/materials.js";
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

test("soundMaterialFor maps upper tiers to the closest recorded material", () => {
  assert.equal(soundMaterialFor("Rosewood"), "Wood");
  assert.equal(soundMaterialFor("Jade"), "Stone");
  assert.equal(soundMaterialFor("Cloisonné"), "Porcelain");
  assert.equal(soundMaterialFor("Lacquer"), "Resin");
  assert.equal(soundMaterialFor("Bamboo"), "Bamboo");
  assert.equal(soundMaterialFor("Adamantium"), "Wood");
});

// Face art has to stay legible on every material. A material's face used to
// be picked purely for looks, which left Wood's painted art at 1.51:1 —
// effectively invisible, on the tier every new player starts with.
const FACE_INKS = ["#b5322c", "#1f7a4d", "#2b5f9e", "#23201c"];
const MIN_CONTRAST = 3;

function relLuminance(hex) {
  const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = parts.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(hexA, hexB) {
  const a = relLuminance(hexA), b = relLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function faceMidpoint(m) {
  const avg = [1, 3, 5].map((i) => Math.round((parseInt(m.a.slice(i, i + 2), 16) + parseInt(m.b.slice(i, i + 2), 16)) / 2));
  return `#${avg.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

test("every material's face carries its ink at readable contrast", () => {
  for (const [name, m] of Object.entries(MATERIALS)) {
    const face = faceMidpoint(m);
    // Dark materials override the per-face colors with one pale ink, so
    // that's the only ink that has to clear the bar on them.
    const inks = m.ink ? [m.ink] : FACE_INKS;
    for (const ink of inks) {
      const ratio = contrast(ink, face);
      assert.ok(ratio >= MIN_CONTRAST, `${name}: ink ${ink} on ${face} is ${ratio.toFixed(2)}:1, below ${MIN_CONTRAST}:1`);
    }
  }
});
