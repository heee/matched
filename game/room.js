// Matched — local room construction. Pure function mirroring the shape
// worker/index.js's buildRoom() produces, so the client can create a fully
// playable room offline (no Worker configured yet) and, once a Worker
// exists, the same object round-trips through /create-room untouched.

import { generateBoard, mulberry32, hashSeed } from "./mahjong.js";
import { DIFFICULTY_TILE_COUNTS, defaultLayoutForDifficulty } from "./layouts.js";

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "room";
}

export function buildLocalRoom({ title, mode, layoutId, difficulty, visibility, createdBy, freeTilesGlow, hintsAllowed, seed, isDaily }) {
  const id = `${slugify(title)}-${Date.now().toString(36)}`;
  const resolvedSeed = seed ?? hashSeed(id);
  const layout = layoutId || defaultLayoutForDifficulty(difficulty).id;
  const board = generateBoard(layout, { rng: mulberry32(resolvedSeed) });
  const players = mode === "solo" ? [createdBy] : [createdBy, "Dana", "Mika", "Jules"];
  const pairsCleared = {};
  const streaks = {};
  for (const p of players) { pairsCleared[p] = 0; streaks[p] = 0; }

  const room = {
    id,
    title,
    mode,
    layoutId: layout,
    tileCount: board.tiles.length,
    difficulty,
    visibility: visibility || "open",
    createdBy,
    createdAt: new Date().toISOString(),
    startedAt: Date.now(),
    freeTilesGlow: freeTilesGlow !== false,
    hintsAllowed: hintsAllowed !== false,
    players,
    pairsCleared,
    streaks,
    assistsUsed: {},
    state: { tiles: board.tiles, tray: [], matchLog: [], state: "open", seed: resolvedSeed },
    completedAt: null,
    isDaily: !!isDaily,
  };

  // Race mode: same layout, but each player clears their own independent
  // copy of the board — "nobody can take a tile out from under you".
  if (mode === "race") {
    room.racers = {};
    players.forEach((p, i) => {
      const racerBoard = generateBoard(layout, { rng: mulberry32(resolvedSeed + i * 104729) });
      room.racers[p] = { tiles: racerBoard.tiles };
    });
  }

  return room;
}

export { DIFFICULTY_TILE_COUNTS };
