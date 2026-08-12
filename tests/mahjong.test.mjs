import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFree,
  freeTiles,
  generateBoard,
  facesMatch,
  clearPair,
  restorePair,
  findHintPair,
  hasMovesRemaining,
  shuffleRemaining,
  boardCompletion,
  mulberry32,
  hashSeed,
} from "../game/mahjong.js";
import { LAYOUTS, DIFFICULTY_TILE_COUNTS } from "../game/layouts.js";
import { buildFaceSet } from "../game/tiles.js";

test("isFree: a tile with nothing above and an open side is free", () => {
  const tiles = [
    { id: "a", x: 0, y: 0, z: 0 },
    { id: "b", x: 1, y: 0, z: 0 },
  ];
  assert.equal(isFree(tiles[0], tiles), true);
  assert.equal(isFree(tiles[1], tiles), true);
});

test("isFree: a tile blocked on both sides at its own layer is not free", () => {
  const tiles = [
    { id: "a", x: 0, y: 0, z: 0 },
    { id: "b", x: 1, y: 0, z: 0 },
    { id: "c", x: 2, y: 0, z: 0 },
  ];
  assert.equal(isFree(tiles[1], tiles), false);
  assert.equal(isFree(tiles[0], tiles), true);
  assert.equal(isFree(tiles[2], tiles), true);
});

test("isFree: a tile with anything stacked directly above it is not free", () => {
  const tiles = [
    { id: "a", x: 0, y: 0, z: 0 },
    { id: "b", x: 0, y: 0, z: 1 },
  ];
  assert.equal(isFree(tiles[0], tiles), false);
  assert.equal(isFree(tiles[1], tiles), true);
});

test("freeTiles matches isFree for every tile", () => {
  const board = generateBoard("dragons-nest", { rng: mulberry32(1) });
  const free = freeTiles(board.tiles);
  for (const t of free) assert.equal(isFree(t, board.tiles), true);
  const notFree = board.tiles.filter((t) => !free.includes(t));
  for (const t of notFree) assert.equal(isFree(t, board.tiles), false);
});

for (const layoutId of Object.keys(LAYOUTS)) {
  test(`generateBoard(${layoutId}) places every position exactly once with matching pairs`, () => {
    const layout = LAYOUTS[layoutId];
    const rng = mulberry32(hashSeed(layoutId));
    const board = generateBoard(layoutId, { rng });
    assert.equal(board.tiles.length, layout.positions().length);
    assert.equal(board.tiles.length % 2, 0);

    const counts = new Map();
    for (const t of board.tiles) counts.set(t.face.id, (counts.get(t.face.id) || 0) + 1);
    for (const [, count] of counts) assert.equal(count % 2, 0, "every face must appear an even number of times");
  });
}

test("generated boards are solvable in at least one order (reverse of construction)", () => {
  // Repeatedly clear any available free matching pair until nothing remains.
  const rng = mulberry32(42);
  let board = generateBoard("dragons-nest", { rng });
  let tiles = board.tiles;
  let iterations = 0;
  while (tiles.length > 0 && iterations++ < 1000) {
    const pair = findHintPair(tiles);
    assert.ok(pair, `board got stuck with ${tiles.length} tiles remaining`);
    const result = clearPair(tiles, pair[0], pair[1]);
    assert.ok(result);
    tiles = result.tiles;
  }
  assert.equal(tiles.length, 0);
});

test("facesMatch requires same face id and different tile instances", () => {
  const faces = buildFaceSet();
  const a = { id: "a", face: faces[0] };
  const b = { id: "b", face: faces[0] };
  const c = { id: "c", face: faces[1] };
  assert.equal(facesMatch(a, b), true);
  assert.equal(facesMatch(a, c), false);
  assert.equal(facesMatch(a, a), false);
});

test("clearPair removes exactly the matched pair and rejects a non-match", () => {
  const faces = buildFaceSet();
  const tiles = [
    { id: "a", x: 0, y: 0, z: 0, face: faces[0] },
    { id: "b", x: 1, y: 0, z: 0, face: faces[0] },
    { id: "c", x: 2, y: 0, z: 0, face: faces[1] },
  ];
  const result = clearPair(tiles, "a", "b");
  assert.ok(result);
  assert.equal(result.tiles.length, 1);
  assert.equal(result.tiles[0].id, "c");
  assert.equal(result.removed.length, 2);

  assert.equal(clearPair(tiles, "a", "c"), null);
});

test("restorePair puts a cleared pair back onto the board (undo)", () => {
  const faces = buildFaceSet();
  const tiles = [
    { id: "a", x: 0, y: 0, z: 0, face: faces[0] },
    { id: "b", x: 1, y: 0, z: 0, face: faces[0] },
  ];
  const result = clearPair(tiles, "a", "b");
  const restored = restorePair(result.tiles, result.removed);
  assert.equal(restored.length, 2);
  assert.deepEqual(restored.map((t) => t.id).sort(), ["a", "b"]);
});

test("findHintPair finds a real matching pair among free tiles only", () => {
  const rng = mulberry32(7);
  const board = generateBoard("two-bridges", { rng });
  const pair = findHintPair(board.tiles);
  assert.ok(pair);
  const [idA, idB] = pair;
  const a = board.tiles.find((t) => t.id === idA);
  const b = board.tiles.find((t) => t.id === idB);
  assert.equal(a.face.id, b.face.id);
  assert.equal(isFree(a, board.tiles), true);
  assert.equal(isFree(b, board.tiles), true);
});

test("hasMovesRemaining is false once no free pair exists", () => {
  assert.equal(hasMovesRemaining([]), false);
});

test("shuffleRemaining keeps the same positions and pair-parity, and stays solvable", () => {
  const rng = mulberry32(99);
  const board = generateBoard("dragons-nest", { rng: mulberry32(3) });
  const shuffled = shuffleRemaining(board.tiles, { rng });

  assert.equal(shuffled.length, board.tiles.length);
  const positionsBefore = board.tiles.map((t) => `${t.x},${t.y},${t.z}`).sort();
  const positionsAfter = shuffled.map((t) => `${t.x},${t.y},${t.z}`).sort();
  assert.deepEqual(positionsAfter, positionsBefore);

  const counts = new Map();
  for (const t of shuffled) counts.set(t.face.id, (counts.get(t.face.id) || 0) + 1);
  for (const [, count] of counts) assert.equal(count % 2, 0);

  // Solvable: clear it all the way down using only free matching pairs.
  let tiles = shuffled;
  let iterations = 0;
  while (tiles.length > 0 && iterations++ < 1000) {
    const pair = findHintPair(tiles);
    assert.ok(pair);
    tiles = clearPair(tiles, pair[0], pair[1]).tiles;
  }
  assert.equal(tiles.length, 0);
});

test("boardCompletion computes a percentage of cleared tiles", () => {
  assert.equal(boardCompletion(52, 52), 0);
  assert.equal(boardCompletion(52, 0), 100);
  assert.equal(boardCompletion(52, 26), 50);
  assert.equal(boardCompletion(0, 0), 0);
});

test("difficulty tile counts match the spec presets", () => {
  assert.deepEqual(DIFFICULTY_TILE_COUNTS, { easy: 36, medium: 52, hard: 72 });
});

test("mulberry32 is deterministic for a given seed", () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});
