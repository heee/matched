// Matched — local room construction. Pure function mirroring the shape
// worker/index.js's buildRoom() produces, so the client can create a fully
// playable room offline (no Worker configured yet) and, once a Worker
// exists, the same object round-trips through /create-room untouched.

import { generateBoard, mulberry32, hashSeed } from "./mahjong.js";
import { DIFFICULTY_TILE_COUNTS, defaultLayoutForDifficulty } from "./layouts.js";
import { isActualPlayerName } from "./identity.js";

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "room";
}

export function buildLocalRoom({ title, mode, layoutId, difficulty, visibility, createdBy, freeTilesGlow, hintsAllowed, shuffleAllowed, openPairsAllowed, undoAllowed, suddenDeath, seed, isDaily, bots, players: livePlayers, turnRule, turnSeconds }) {
  if (!isActualPlayerName(createdBy)) throw new TypeError("A human creator is required");
  const id = `${slugify(title)}-${Date.now().toString(36)}`;
  const resolvedSeed = seed ?? hashSeed(id);
  const layout = layoutId || defaultLayoutForDifficulty(difficulty).id;
  const board = generateBoard(layout, { rng: mulberry32(resolvedSeed) });
  // Bots are opt-in per room (picked in room-setup's seat grid, each with
  // its own { name, difficulty }) — a solo or live room never has them
  // regardless of what was picked before switching mode. botNames is kept
  // alongside players so Ranking (and anything else scanning completed
  // rooms) can exclude bots from real-player stats without guessing by name.
  const botList = mode === "solo" || mode === "live" ? [] : (bots || []);
  const botNames = botList.map((b) => b.name);
  if (botNames.includes(createdBy)) throw new TypeError("A bot cannot create a room");
  // Live is hot-seat play — one device, a roster of real local players
  // passed in from room-setup's roster editor (falls back to just the
  // creator if somehow empty).
  const players = mode === "solo" ? [createdBy]
    : mode === "live" ? (livePlayers && livePlayers.length ? livePlayers : [createdBy])
    : [createdBy, ...botNames];
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
    // Shared rooms sit in a lobby until the host explicitly starts play —
    // everyone else is gated out of the board until this flips true. Every
    // other mode has no lobby, so it starts true.
    gameStarted: mode !== "shared",
    // Shared rooms may wait in the invite sheet indefinitely. Board screens
    // set this when play actually begins (the first match for Shared).
    startedAt: null,
    // Accumulated/open "someone has the board on screen" windows — see
    // game/time.js. Starts empty; the board screen opens the first window.
    activeMs: 0,
    activeWindow: null,
    freeTilesGlow: freeTilesGlow !== false,
    hintsAllowed: hintsAllowed !== false,
    // Sudden death (game ends the instant no pairs are left to match) and
    // shuffle (which exists to rescue a stuck board) are mutually
    // exclusive — enforced here too, not just in room-setup's UI, so a
    // sudden-death room can never accidentally carry a rescue valve.
    suddenDeath: !!suddenDeath,
    shuffleAllowed: suddenDeath ? false : shuffleAllowed !== false,
    openPairsAllowed: openPairsAllowed !== false,
    // Undo is a fairness/integrity concern in modes other people are also
    // playing in real time — only Solo (and hot-seat Live, where it's
    // always been on) ever gets it, and Solo's is the only user-facing
    // toggle for it.
    undoAllowed: mode === "solo" ? undoAllowed !== false : mode === "live",
    // Live-only: whose turn it is (index into players) and the turn-end
    // rule chosen at setup. Irrelevant, and left undefined, outside live.
    turnRule: mode === "live" ? (turnRule || "single") : undefined,
    turnSeconds: mode === "live" && turnRule === "timed" ? (turnSeconds || 20) : undefined,
    turnIndex: mode === "live" ? 0 : undefined,
    turnStartedAt: null,
    players,
    botNames,
    botDifficulty: Object.fromEntries(botList.map((b) => [b.name, b.difficulty])),
    pairsCleared,
    streaks,
    assistsUsed: {},
    state: { tiles: board.tiles, tray: [], matchLog: [], state: mode === "solo" ? "ready" : "waiting", seed: resolvedSeed },
    completedAt: null,
    isDaily: !!isDaily,
  };

  // Race mode: same layout, but each player clears their own independent
  // copy of the board — "nobody can take a tile out from under you".
  if (mode === "race") {
    room.racers = {};
    players.forEach((p, i) => {
      const racerBoard = generateBoard(layout, { rng: mulberry32(resolvedSeed + i * 104729) });
      room.racers[p] = { tiles: racerBoard.tiles, stuckOut: false };
    });
  }

  return room;
}

// Adds a racer board for a player joining an existing race-mode room after
// creation (open-room join, invite link). No-op outside race mode or if the
// player already has one — race-board.js bounces to home whenever the
// current player has no `racers` entry for them.
export function ensureRacer(room, player) {
  if (room.mode !== "race" || !player) return;
  if (!room.racers) room.racers = {};
  if (room.racers[player]) return;
  const seedOffset = Object.keys(room.racers).length * 104729;
  const racerBoard = generateBoard(room.layoutId, { rng: mulberry32(room.state.seed + seedOffset) });
  room.racers[player] = { tiles: racerBoard.tiles, stuckOut: false };
}

export { DIFFICULTY_TILE_COUNTS };
