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

export const MATERIALS = {
  Wood:       { a: "#c9a06b", b: "#8a6239", edge: "#5c4023", upper: "#d8b184" },
  Stone:      { a: "#c9c9c4", b: "#94938c", edge: "#5c5b55", upper: "#d8d8d3" },
  Resin:      { a: "#eef1ea", b: "#cfd6c7", edge: "#96a08a", upper: "#f6f8f3" },
  Bamboo:     { a: "#dcd08c", b: "#a89751", edge: "#7c6c31", upper: "#e8dfa4" },
  Bone:       { a: "#f7f2e4", b: "#e9e0cb", edge: "#b3a582", upper: "#fffdf6" },
  Porcelain:  { a: "#f5f7fb", b: "#dbe4f2", edge: "#2b5f9e", upper: "#ffffff" },
  Rosewood:   { a: "#8b4a3d", b: "#5c2c22", edge: "#caa14a", upper: "#a15b4c", dark: true, ink: "#e8c887" },
  Jade:       { a: "#cfe6da", b: "#9dc4b1", edge: "#6d9482", upper: "#ddefe5" },
  "Cloisonné": { a: "#2b5f9e", b: "#1a3c66", edge: "#d9a441", upper: "#3a72b5", dark: true, ink: "#f0d79a" },
  Lacquer:    { a: "#3a1418", b: "#0d0607", edge: "#d9a441", upper: "#4d1c21", dark: true, ink: "#f0d79a" },
};

export const DEFAULT_MATERIAL = "Bone";

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
