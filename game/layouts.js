// Matched — board layout geometry.
// Pure data: tile positions (column/row/layer) for each curated layout.
// Tile geometry constants match docs/Matched_Build_Spec_v1.0.md exactly:
// 40x52pt face, 40pt column step, 40pt row step, 5pt up-left offset per layer.

export const TILE_W = 40;
export const TILE_H = 52;
export const STEP_X = 40;
export const STEP_Y = 40;
export const LAYER_OFFSET = 5;

function rect(x0, x1, y0, y1, z) {
  const out = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out.push({ x, y, z });
  }
  return out;
}

// Curated layouts, not generated — mahjong geometry does not benefit from
// procedural generation the way crossword fill does (see build brief).
// Each layout's position count must be even; the generator places pairs
// only, never a lone tile.
export const LAYOUTS = {
  "two-bridges": {
    id: "two-bridges",
    name: "Two Bridges",
    tileCount: 36,
    difficulty: "easy",
    layers: 2,
    tier: null,
    positions: () => [...rect(0, 5, 0, 3, 0), ...rect(1, 4, 0, 2, 1)],
  },
  "dragons-nest": {
    id: "dragons-nest",
    name: "Dragon's Nest",
    tileCount: 52,
    difficulty: "medium",
    layers: 2,
    tier: null,
    // Matches the working prototype in docs/design-reference.html exactly.
    positions: () => [...rect(0, 7, 0, 4, 0), ...rect(2, 5, 1, 3, 1)],
  },
  "eight-winds": {
    id: "eight-winds",
    name: "Eight Winds",
    tileCount: 48,
    difficulty: "medium",
    layers: 2,
    tier: null,
    positions: () => [...rect(0, 7, 0, 4, 0), ...rect(1, 6, 1, 3, 1).filter((_, i) => i % 3 !== 2)],
  },
  "garden-gate": {
    id: "garden-gate",
    name: "Garden Gate",
    tileCount: 60,
    difficulty: "hard",
    layers: 3,
    tier: null,
    positions: () => [...rect(0, 7, 0, 4, 0), ...rect(1, 6, 0, 3, 1), ...rect(3, 4, 1, 2, 2)],
  },
  "nine-gates": {
    id: "nine-gates",
    name: "Nine Gates",
    tileCount: 72,
    difficulty: "hard",
    layers: 3,
    tier: "Rosewood",
    positions: () => [...rect(0, 7, 0, 4, 0), ...rect(1, 6, 0, 3, 1), ...rect(2, 5, 1, 2, 2)],
  },
  "long-table": {
    id: "long-table",
    name: "Long Table",
    tileCount: 64,
    difficulty: "hard",
    layers: 2,
    tier: "Dragon",
    positions: () => [...rect(0, 9, 0, 3, 0), ...rect(2, 7, 0, 2, 1)],
  },
  // Classic 144-tile "turtle" — a tablet layout. The whole-board-always-
  // fits rule caps a phone layer at roughly 8x5, so this is unreachable on
  // phone widths for now (see build brief); kept as a stub so the catalog
  // and generator both know about it without wiring it into phone play.
  "great-wall": {
    id: "great-wall",
    name: "Great Wall",
    tileCount: 144,
    difficulty: "turtle",
    layers: 5,
    tier: null,
    tabletOnly: true,
    positions: () => [
      ...rect(0, 13, 0, 7, 0),
      ...rect(1, 12, 1, 6, 1),
      ...rect(3, 10, 2, 5, 2),
      ...rect(5, 8, 3, 4, 3),
      { x: 6, y: 3, z: 4 },
      { x: 7, y: 3, z: 4 },
    ],
  },
};

export const DIFFICULTY_TILE_COUNTS = { easy: 36, medium: 52, hard: 72 };

export function layoutsByDifficulty(difficulty) {
  return Object.values(LAYOUTS).filter((l) => l.difficulty === difficulty && !l.tabletOnly);
}

export function getLayout(id) {
  return LAYOUTS[id] || null;
}

export function defaultLayoutForDifficulty(difficulty) {
  const matches = layoutsByDifficulty(difficulty);
  return matches[0] || LAYOUTS["dragons-nest"];
}
