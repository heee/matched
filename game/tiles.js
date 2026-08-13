// Matched — tile face catalog.
// Pure data + pure helpers, no DOM. Ink colors and glyphs match
// docs/Matched_Build_Spec_v1.0.md ("Ink colors on tile faces") and the
// working prototype in docs/design-reference.html (#1f script block).
//
// Real tile art will be dropped into these slots later (see the spec's
// "Tile Art" section) — nothing about layout or matching depends on the
// placeholder glyph rendering.

export const INK = "#23201c";
export const RED = "#b5322c";
export const GREEN = "#1f7a4d";
export const BLUE = "#2b5f9e";

// Flowers/seasons are explicitly out of scope for matching (spec: "skip
// them in the generator for now") — they exist here only as an ART SLOT
// placeholder id so a future layout could reference one without matching.
export const FLOWER_SLOT = { id: "flower", kind: "slot" };

const CRAK_NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WINDS = ["東", "南", "西", "北"];
const DRAGONS = [
  { glyph: "中", color: RED },
  { glyph: "發", color: GREEN },
  { glyph: "白", color: BLUE },
];

// Builds the full 34-face standard set (craks 1-9, dots 1-9, bamboo 1-9,
// 4 winds, 3 dragons). Two of each face are placed onto a board — never
// four, since this is solitaire pairing, not scoring mahjong.
export function buildFaceSet() {
  const faces = [];
  CRAK_NUMS.forEach((n, i) => {
    faces.push({ id: `crak${i + 1}`, kind: "char", top: n, bot: "萬", color: i % 2 ? BLUE : RED });
  });
  WINDS.forEach((w, i) => {
    faces.push({ id: `wind${i}`, kind: "char", top: w, bot: "", color: INK });
  });
  DRAGONS.forEach((d, i) => {
    faces.push({ id: `dragon${i}`, kind: "char", top: d.glyph, bot: "", color: d.color });
  });
  for (let n = 1; n <= 9; n++) {
    faces.push({ id: `dot${n}`, kind: "dot", n, color: n % 2 ? RED : GREEN });
  }
  for (let n = 1; n <= 9; n++) {
    faces.push({ id: `bam${n}`, kind: "bam", n, color: GREEN });
  }
  return faces;
}

// Pip layout (percent-based, dot faces) — used by the board screen to draw
// geometric pips instead of glyphs. Kept here (not in a UI module) because
// it is a pure function of face data.
//
// Percentages are of the FACE box (34x46 units), which is taller than it is
// wide — so equal percent steps are NOT equal distances on the two axes, and
// a grid specified with a wider row span than column span comes out visibly
// stretched. These spans are chosen so the pips land on a near-square grid
// at real distances: 3-column rows sit 21/50/79 (~10 units apart) and the
// 3x3 rows sit 28/50/72 (~10.1 units apart). 10 units is the tightest
// spacing anywhere in this table, which is what caps PIP_SIZE in
// screens/shared-ui.js — widen a span here and the pips can grow with it.
const DOT_GRIDS = {
  1: [[50, 50]],
  2: [[50, 30], [50, 70]],
  3: [[24, 26], [50, 50], [76, 74]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 27], [72, 27], [50, 50], [28, 73], [72, 73]],
  6: [[30, 24], [70, 24], [30, 50], [70, 50], [30, 76], [70, 76]],
  7: [[30, 22], [70, 22], [30, 44], [70, 44], [30, 66], [70, 66], [50, 88]],
  8: [[21, 22], [50, 22], [79, 22], [21, 50], [79, 50], [21, 78], [50, 78], [79, 78]],
  9: [[21, 28], [50, 28], [79, 28], [21, 50], [50, 50], [79, 50], [21, 72], [50, 72], [79, 72]],
};

export function dotPips(n) {
  return DOT_GRIDS[n] || DOT_GRIDS[1];
}

// Bamboo faces render as n vertical sticks in a wrapped grid.
export function bamSticks(n) {
  const cols = n <= 3 ? n : n <= 6 ? Math.ceil(n / 2) : 3;
  const rows = Math.ceil(n / cols);
  const sticks = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = cols === 1 ? 50 : 22 + (col * 56) / (cols - 1);
    const top = rows === 1 ? 50 : 22 + (row * 56) / (rows - 1);
    sticks.push({ left, top });
  }
  return sticks;
}
