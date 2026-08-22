// Matched — the board engine.
// Pure functions only, no DOM. Layout definitions live in layouts.js, tile
// face data lives in tiles.js. This module: free-tile detection, solvable
// board generation by reverse construction, match validation, hint/shuffle.
//
// A tile is free iff no tile sits directly above it (any layer above, same
// row/col footprint) AND it is not blocked on both its left and right at
// its own layer — per docs/Matched_Build_Spec_v1.0.md.

import { getLayout } from "./layouts.js";
import { buildFaceSet } from "./tiles.js";

// Deterministic PRNG (mulberry32) so board generation is reproducible in
// tests and for the daily puzzle (same seed -> same board for everyone).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function isFree(tile, liveTiles) {
  const above = liveTiles.some((o) => o.z === tile.z + 1 && o.x === tile.x && o.y === tile.y);
  if (above) return false;
  const blockedLeft = liveTiles.some((o) => o.z === tile.z && o.y === tile.y && o.x === tile.x - 1);
  const blockedRight = liveTiles.some((o) => o.z === tile.z && o.y === tile.y && o.x === tile.x + 1);
  return !(blockedLeft && blockedRight);
}

export function freeTiles(tiles) {
  return tiles.filter((t) => isFree(t, tiles));
}

// Reverse construction: starts from an empty board and repeatedly claims a
// pair of positions that are free *in the remaining set*, assigning them a
// matching face. Because each pair is only ever placed onto positions that
// are free given everything placed so far, popping tiles off in the
// opposite order in which they were added here is always a valid clear
// order — i.e. the resulting board is guaranteed solvable in at least one
// order.
function generateFromPositions(positions, faces, rng) {
  const remaining = positions.map((p, i) => ({ x: p.x, y: p.y, z: p.z, id: `t${i}`, face: null }));
  const placed = [];
  let faceIndex = 0;
  let guard = 0;
  const guardLimit = positions.length * 30 + 50;

  while (remaining.length >= 2 && guard++ < guardLimit) {
    const free = remaining.filter((t) => isFree(t, remaining));
    if (free.length < 2) return null; // dead end — caller retries with a new seed
    const a = free[Math.floor(rng() * free.length)];
    const restFree = free.filter((t) => t !== a);
    const b = restFree[Math.floor(rng() * restFree.length)];
    const face = faces[faceIndex % faces.length];
    faceIndex++;
    for (const t of [a, b]) {
      t.face = face;
      placed.push(t);
      remaining.splice(remaining.indexOf(t), 1);
    }
  }
  if (remaining.length !== 0) return null;
  return placed;
}

// Generates a solvable board for a curated layout. Retries with a fresh
// draw from `rng` (or a fresh Math.random draw) up to `maxAttempts` times —
// the greedy reverse-construction walk can occasionally paint itself into
// a corner on asymmetric layouts.
export function generateBoard(layoutId, options = {}) {
  const layout = getLayout(layoutId);
  if (!layout) throw new Error(`Unknown layout: ${layoutId}`);
  const rng = options.rng || Math.random;
  const faces = options.faces || buildFaceSet();
  const maxAttempts = options.maxAttempts || 60;
  const positions = layout.positions();
  if (positions.length % 2 !== 0) {
    throw new Error(`Layout ${layoutId} has an odd tile count (${positions.length})`);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tiles = generateFromPositions(positions, faces, rng);
    if (tiles) return { layoutId, tileCount: tiles.length, tiles };
  }
  throw new Error(`Could not generate a solvable board for ${layoutId} after ${maxAttempts} attempts`);
}

export function facesMatch(a, b) {
  return !!a && !!b && a.id !== b.id && a.face.id === b.face.id;
}

// Removes a matched pair from the board. Returns the new tile list plus the
// two removed tiles (for tray rendering / undo).
export function clearPair(tiles, idA, idB) {
  const a = tiles.find((t) => t.id === idA);
  const b = tiles.find((t) => t.id === idB);
  if (!facesMatch(a, b)) return null;
  const remaining = tiles.filter((t) => t.id !== idA && t.id !== idB);
  return { tiles: remaining, removed: [a, b] };
}

// Pushes a previously-cleared pair back onto the board (assist: undo).
export function restorePair(tiles, removedPair) {
  return [...tiles, ...removedPair];
}

// Hint: any currently-valid free matching pair. Returns [idA, idB] or null.
export function findHintPair(tiles) {
  const free = freeTiles(tiles);
  const byFace = new Map();
  for (const t of free) {
    const existing = byFace.get(t.face.id);
    if (existing) return [existing.id, t.id];
    byFace.set(t.face.id, t);
  }
  return null;
}

// Every currently-valid free matching pair. Keeping this pure lets visual
// clue features choose randomly without changing the deterministic Hint and
// bot behavior that relies on findHintPair's first match.
export function findHintPairs(tiles) {
  const free = freeTiles(tiles);
  const byFace = new Map();
  for (const tile of free) {
    const group = byFace.get(tile.face.id) || [];
    group.push(tile);
    byFace.set(tile.face.id, group);
  }
  const pairs = [];
  for (const group of byFace.values()) {
    for (let i = 0; i < group.length - 1; i++) {
      for (let j = i + 1; j < group.length; j++) pairs.push([group[i].id, group[j].id]);
    }
  }
  return pairs;
}

export function findRandomHintPair(tiles, rng = Math.random) {
  const pairs = findHintPairs(tiles);
  if (pairs.length === 0) return null;
  return pairs[Math.floor(rng() * pairs.length)];
}

export function hasMovesRemaining(tiles) {
  return !!findHintPair(tiles);
}

// Re-randomizes remaining tile faces onto the same open positions, running
// the same reverse-construction walk over the current position set so the
// reshuffled board stays solvable (per build brief: "shuffle ... keeping
// solvability").
export function shuffleRemaining(tiles, options = {}) {
  const rng = options.rng || Math.random;
  const faces = options.faces || buildFaceSet();
  const maxAttempts = options.maxAttempts || 60;
  const positions = tiles.map((t) => ({ x: t.x, y: t.y, z: t.z }));
  if (positions.length === 0) return tiles;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rebuilt = generateFromPositions(positions, faces, rng);
    if (rebuilt) {
      // generateFromPositions returns tiles in placement order, not input
      // order — realign by the synthetic `t{index}` id it assigns from the
      // original positions[] index, so face i lands back on tiles[i].
      const faceByIndex = new Array(positions.length);
      for (const t of rebuilt) faceByIndex[Number(t.id.slice(1))] = t.face;
      return tiles.map((t, i) => ({ ...t, face: faceByIndex[i] }));
    }
  }
  return tiles; // extremely unlikely; leave the board untouched rather than break it
}

export function boardCompletion(originalCount, remainingCount) {
  if (originalCount <= 0) return 0;
  return Math.round(((originalCount - remainingCount) / originalCount) * 100);
}
