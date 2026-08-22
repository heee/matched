// Matched — tile material palettes.
// Pure data, no DOM. One entry per tier material (see TIERS in scoring.js);
// the board renders the equipped one, and the Profile screen builds its
// swatches from the same values so the preview can't drift from the board.
//
// `a`/`b` are the face gradient stops, `edge` the tile's thickness edge,
// `upper` the lighter face used on stacked layers. `dark` materials need a
// pale ink (`ink`) because the standard red/green/blue face colors vanish
// against them — those tiers still want their own pip/bamboo art, which
// hasn't been generated yet (the light materials all reuse Bone's).

import { TIER_UNLOCKS, tierForPoints } from "./scoring.js";

// Wood, Stone and Bamboo carry their color in the thickness edge and keep a
// light face. Their original mid-tone faces sat too close in luminance to
// the painted red/green art to read (Wood was the worst at 1.51:1, and it's
// the tier-0 default every new player starts on); a real wooden tile is a
// pale face in a dark timber frame anyway. Pale inlay was the alternative,
// but it fails on Stone and Bamboo, which are too light to carry it.
export const MATERIALS = {
  Wood:       { a: "#ecdcc3", b: "#cdb28a", edge: "#7a5533", upper: "#f6ebd9" },
  Stone:      { a: "#dfdfdc", b: "#c0bfbb", edge: "#7d7c76", upper: "#efefec" },
  Resin:      { a: "#eef1ea", b: "#cfd6c7", edge: "#96a08a", upper: "#f6f8f3" },
  Bamboo:     { a: "#e9e2b8", b: "#c9bf93", edge: "#8d7c3c", upper: "#f4efd2" },
  Bone:       { a: "#f7f2e4", b: "#e9e0cb", edge: "#b3a582", upper: "#fffdf6" },
  Porcelain:  { a: "#f5f7fb", b: "#dbe4f2", edge: "#2b5f9e", upper: "#ffffff" },
  Rosewood:   { a: "#8b4a3d", b: "#5c2c22", edge: "#caa14a", upper: "#a15b4c", dark: true, ink: "#e8c887" },
  Jade:       { a: "#cfe6da", b: "#9dc4b1", edge: "#6d9482", upper: "#ddefe5" },
  "Cloisonné": { a: "#2b5f9e", b: "#1a3c66", edge: "#d9a441", upper: "#3a72b5", dark: true, ink: "#f0d79a" },
  Lacquer:    { a: "#3a1418", b: "#0d0607", edge: "#d9a441", upper: "#4d1c21", dark: true, ink: "#f0d79a" },
};

export const DEFAULT_MATERIAL = "Bone";

// Sound families follow the material's physical construction. The four
// upper tiers reuse the closest real recording until they warrant their own
// distinct foley: rosewood is wood, jade is stone, enamelled cloisonné is
// porcelain-like, and lacquer is closest to hard resin.
export const SOUND_MATERIALS = {
  Wood: "Wood",
  Stone: "Stone",
  Resin: "Resin",
  Bamboo: "Bamboo",
  Bone: "Bone",
  Porcelain: "Porcelain",
  Rosewood: "Wood",
  Jade: "Stone",
  "Cloisonné": "Porcelain",
  Lacquer: "Resin",
};

export function soundMaterialFor(name) {
  return SOUND_MATERIALS[name] || "Wood";
}

export function materialFor(name) {
  return MATERIALS[name] || MATERIALS[DEFAULT_MATERIAL];
}

// Which material is actually in play: the player's saved pick if they still
// have it unlocked, otherwise their current tier's default. Shared by the
// board and the Profile equip grid so the two can't disagree about what's
// equipped (the resolution used to live only in the Profile screen, where
// the board couldn't reach it).
export function equippedMaterialName(points, equipped) {
  const stored = equipped && equipped.material;
  if (stored && MATERIALS[stored] && points >= TIER_UNLOCKS[stored].materialThreshold) return stored;
  return tierForPoints(points).material;
}

// The CSS custom properties .tile reads. Set on a board wrapper so every
// tile under it picks the material up by inheritance, rather than styling
// each tile inline.
export function materialCssVars(name) {
  const m = materialFor(name);
  return `--tile-a:${m.a};--tile-b:${m.b};--tile-edge:${m.edge};--tile-upper:${m.upper}`;
}

// Face ink for a material: dark materials override the per-face color
// (red/green/blue) with a pale one, since those vanish on a dark surface.
// Returns null when the face's own color should be used as-is.
export function inkOverrideFor(name) {
  return materialFor(name).ink || null;
}
