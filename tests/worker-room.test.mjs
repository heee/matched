import test from "node:test";
import assert from "node:assert/strict";
import { RoomDO, buildRoom, loadData, repairRoomMetadata, validateCreateRoom } from "../worker/index.js";

function free(tile, tiles) {
  const above = tiles.some((other) => other.z === tile.z + 1 && other.x === tile.x && other.y === tile.y);
  const left = tiles.some((other) => other.z === tile.z && other.y === tile.y && other.x === tile.x - 1);
  const right = tiles.some((other) => other.z === tile.z && other.y === tile.y && other.x === tile.x + 1);
  return !above && !(left && right);
}

function firstFreePair(tiles) {
  const available = tiles.filter((tile) => free(tile, tiles));
  for (const tile of available) {
    const match = available.find((other) => other !== tile && other.face.id === tile.face.id);
    if (match) return [tile, match];
  }
  return null;
}

function mockDb(room) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => sql.includes("SELECT payload_json") ? { payload_json: JSON.stringify(room) } : null,
            run: async () => ({ success: true, values }),
          };
        },
      };
    },
  };
}

test("RoomDO accepts a shared clear, commits the player, and broadcasts the result", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges",
    mode: "shared",
    layoutId: "two-bridges",
    difficulty: "easy",
    visibility: "open",
    createdBy: "Henning",
  });
  const room = buildRoom(request);
  const pair = firstFreePair(room.state.tiles);
  assert.ok(pair);

  const frames = [];
  const socket = {
    send: (frame) => frames.push(JSON.parse(frame)),
    deserializeAttachment: () => ({ user: "Christie", spectator: false }),
    serializeAttachment: () => {},
  };
  const stored = new Map([["room", room]]);
  const state = {
    storage: {
      get: async (key) => stored.get(key),
      put: async (key, value) => stored.set(key, value),
      setAlarm: async () => {},
    },
    getWebSockets: () => [socket],
  };
  const instance = new RoomDO(state, { DB: mockDb(room) });
  instance.room = room;

  await instance.webSocketMessage(socket, JSON.stringify({ type: "clear-pair", idA: pair[0].id, idB: pair[1].id }));

  assert.ok(room.players.includes("Christie"));
  assert.equal(room.pairsCleared.Christie, 1);
  assert.equal(room.state.tiles.length, room.tileCount - 2);
  assert.equal(frames.at(-1).type, "cleared");
  assert.equal(frames.at(-1).user, "Christie");
  assert.equal(room.startedAt, room.state.matchLog[0].at);
});

test("RoomDO broadcasts authoritative race progress without touching another racer's board", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges",
    mode: "race",
    layoutId: "two-bridges",
    difficulty: "easy",
    visibility: "open",
    createdBy: "Henning",
  });
  const room = buildRoom(request);
  const pair = firstFreePair(room.racers.Henning.tiles);
  assert.ok(pair);
  const originalSharedTiles = room.state.tiles.length;

  const frames = [];
  const sender = {
    send: (frame) => frames.push(JSON.parse(frame)),
    deserializeAttachment: () => ({ user: "Henning", spectator: false }),
    serializeAttachment: () => {},
  };
  const observer = {
    send: (frame) => frames.push(JSON.parse(frame)),
    deserializeAttachment: () => ({ user: "Christie", spectator: false }),
    serializeAttachment: () => {},
  };
  const stored = new Map([["room", room]]);
  const state = {
    storage: {
      get: async (key) => stored.get(key),
      put: async (key, value) => stored.set(key, value),
      setAlarm: async () => {},
    },
    getWebSockets: () => [sender, observer],
  };
  const instance = new RoomDO(state, { DB: mockDb(room) });
  instance.room = room;

  await instance.webSocketMessage(sender, JSON.stringify({ type: "race-clear-pair", idA: pair[0].id, idB: pair[1].id }));

  assert.equal(room.racers.Henning.tiles.length, room.tileCount - 2);
  assert.equal(room.state.tiles.length, originalSharedTiles);
  assert.equal(room.pairsCleared.Henning, 1);
  assert.equal(frames.at(-1).type, "race-cleared");
  assert.equal(frames.at(-1).remaining, room.tileCount - 2);
});

test("RoomDO shuffle assist reshuffles only the requesting racer's own board", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges",
    mode: "race",
    layoutId: "two-bridges",
    difficulty: "easy",
    visibility: "open",
    createdBy: "Henning",
  });
  const room = buildRoom(request);
  room.racers.Christie = { tiles: JSON.parse(JSON.stringify(room.racers.Henning.tiles)) };
  const henningFacesBefore = room.racers.Henning.tiles.map((t) => t.face.id);
  const christieFacesBefore = room.racers.Christie.tiles.map((t) => t.face.id);

  const frames = [];
  const sender = {
    send: (frame) => frames.push(JSON.parse(frame)),
    deserializeAttachment: () => ({ user: "Henning", spectator: false }),
    serializeAttachment: () => {},
  };
  const observer = {
    send: (frame) => frames.push(JSON.parse(frame)),
    deserializeAttachment: () => ({ user: "Christie", spectator: false }),
    serializeAttachment: () => {},
  };
  const stored = new Map([["room", room]]);
  const state = {
    storage: {
      get: async (key) => stored.get(key),
      put: async (key, value) => stored.set(key, value),
      setAlarm: async () => {},
    },
    getWebSockets: () => [sender, observer],
  };
  const instance = new RoomDO(state, { DB: mockDb(room) });
  instance.room = room;

  await instance.webSocketMessage(sender, JSON.stringify({ type: "assist", kind: "shuffle" }));

  const henningFacesAfter = room.racers.Henning.tiles.map((t) => t.face.id);
  const christieFacesAfter = room.racers.Christie.tiles.map((t) => t.face.id);
  assert.notDeepEqual(henningFacesAfter, henningFacesBefore);
  assert.deepEqual(christieFacesAfter, christieFacesBefore);
  assert.equal(room.assistsUsed.Henning, 1);
  assert.equal(frames.at(-1).type, "race-shuffled");
  assert.equal(frames.at(-1).user, "Henning");
  assert.deepEqual(frames.at(-1).tiles.map((t) => t.face.id), henningFacesAfter);
});

// A single free, self-matching pair — clearing it empties a racer's board
// in one race-clear-pair call.
const ONE_PAIR_TILES = [
  { id: "p1", x: 0, y: 0, z: 0, face: { id: "bamboo-1" } },
  { id: "p2", x: 6, y: 0, z: 0, face: { id: "bamboo-1" } },
];

test("race-clear-pair leaves the room open for other racers when raceEndOnFirstFinish is off (default)", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges", mode: "race", layoutId: "two-bridges", difficulty: "easy",
    visibility: "open", createdBy: "Henning",
  });
  assert.equal(request.raceEndOnFirstFinish, false);
  const room = buildRoom(request);
  assert.equal(room.raceEndOnFirstFinish, false);
  room.racers.Christie = { tiles: JSON.parse(JSON.stringify(room.racers.Henning.tiles)), stuckOut: false };
  room.racers.Henning.tiles = ONE_PAIR_TILES;

  const frames = [];
  const socket = { send: (frame) => frames.push(JSON.parse(frame)), deserializeAttachment: () => ({ user: "Henning", spectator: false }), serializeAttachment: () => {} };
  const instance = buildDo(room);
  instance.state.getWebSockets = () => [socket];

  await instance.webSocketMessage(socket, JSON.stringify({ type: "race-clear-pair", idA: "p1", idB: "p2" }));

  assert.equal(room.racers.Henning.tiles.length, 0);
  assert.equal(room.completedAt, null); // Christie hasn't finished yet
  assert.equal(room.state.state, "in_progress");
  assert.equal(typeof room.racerElapsedMs.Henning, "number");
  assert.equal(frames.at(-1).completed, false);
  assert.equal(frames.at(-1).remaining, 0);
});

test("race-clear-pair ends the room for everyone on the first finish when raceEndOnFirstFinish is on", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges", mode: "race", layoutId: "two-bridges", difficulty: "easy",
    visibility: "open", createdBy: "Henning", raceEndOnFirstFinish: true,
  });
  assert.equal(request.raceEndOnFirstFinish, true);
  const room = buildRoom(request);
  assert.equal(room.raceEndOnFirstFinish, true);
  room.racers.Christie = { tiles: JSON.parse(JSON.stringify(room.racers.Henning.tiles)), stuckOut: false };
  room.racers.Henning.tiles = ONE_PAIR_TILES;

  const frames = [];
  const socket = { send: (frame) => frames.push(JSON.parse(frame)), deserializeAttachment: () => ({ user: "Henning", spectator: false }), serializeAttachment: () => {} };
  const instance = buildDo(room);
  instance.state.getWebSockets = () => [socket];

  await instance.webSocketMessage(socket, JSON.stringify({ type: "race-clear-pair", idA: "p1", idB: "p2" }));

  assert.equal(room.racers.Henning.tiles.length, 0);
  assert.ok(room.completedAt); // Christie is still mid-board but gets pushed to results too
  assert.equal(room.state.state, "completed");
  assert.equal(frames.at(-1).completed, true);
});

test("RoomDO's alarm evicts a socket that's gone quiet, closing the active window at its last heartbeat instead of the eviction time", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges", mode: "shared", layoutId: "two-bridges", difficulty: "easy",
    visibility: "open", createdBy: "Henning",
  });
  const room = buildRoom(request);
  const now = Date.now();
  // The socket's heartbeats stopped 95s ago (past the 90s staleness
  // threshold) but the alarm only fires and notices every 30s, so there's
  // a gap between "actually went quiet" and "got evicted". Only the first
  // 5s (until the last real heartbeat) should count as active time — not
  // the full 95s dead stretch, which is what left "Sun Court" showing a
  // day-long timer.
  const lastSeen = now - 95_000;
  room.startedAt = lastSeen;
  room.activeWindow = { startedAt: lastSeen };
  room.activeMs = 0;

  let closed = false;
  let alarmSet = null;
  const socket = {
    send: () => {},
    deserializeAttachment: () => ({ user: "Henning", spectator: false, visible: true, lastSeen }),
    serializeAttachment: () => {},
    close: () => { closed = true; },
  };
  const instance = buildDo(room);
  instance.state.getWebSockets = () => (closed ? [] : [socket]);
  instance.state.storage.setAlarm = async (when) => { alarmSet = when; };

  await instance.alarm();

  assert.equal(closed, true, "the stale socket should be force-closed");
  assert.equal(room.activeWindow, null, "the active window should be closed instead of left running");
  assert.equal(room.activeMs, 0, "no active time elapsed between the window opening and the last heartbeat");
  assert.equal(alarmSet, null, "no sockets remain and the window is closed, so no further alarm is needed");
});

test("legacy shared room metadata is repaired from its authoritative match log", () => {
  const firstMatchAt = Date.parse("2026-08-23T20:44:21.330Z");
  const room = {
    mode: "shared",
    startedAt: Date.parse("2026-08-23T00:39:47.256Z"),
    players: ["Henning"],
    startedPlayers: [],
    state: { matchLog: [{ user: "Christie", at: firstMatchAt }] },
  };
  assert.equal(repairRoomMetadata(room), true);
  assert.equal(room.startedAt, firstMatchAt);
  assert.deepEqual(room.players, ["Henning", "Christie"]);
  assert.deepEqual(room.startedPlayers, ["Christie"]);
});

test("room creation carries configured bots into authoritative state", () => {
  const request = validateCreateRoom({
    title: "Two Bridges",
    mode: "shared",
    layoutId: "two-bridges",
    difficulty: "easy",
    visibility: "open",
    createdBy: "Henning",
    bots: [{ name: "Bamboo", difficulty: "hard" }],
  });
  const room = buildRoom(request);
  assert.equal(room.startedAt, null);
  assert.deepEqual(room.players, ["Henning", "Bamboo"]);
  assert.deepEqual(room.botNames, ["Bamboo"]);
  assert.equal(room.botDifficulty.Bamboo, "hard");
});

function buildDo(room) {
  const stored = new Map([["room", room]]);
  const state = {
    storage: {
      get: async (key) => stored.get(key),
      put: async (key, value) => stored.set(key, value),
      setAlarm: async () => {},
    },
    getWebSockets: () => [],
  };
  const instance = new RoomDO(state, { DB: mockDb(room) });
  instance.room = room;
  return instance;
}

// Two free, non-adjacent, non-matching singleton tiles: nothing can ever
// pair up, so hasMovesRemaining reads false without emptying the board.
const STUCK_TILES = [
  { id: "s1", x: 0, y: 0, z: 0, face: { id: "bamboo-1" } },
  { id: "s2", x: 6, y: 0, z: 0, face: { id: "bamboo-2" } },
];

test("sudden death ends a stuck shared room when the client reports it", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges", mode: "shared", layoutId: "two-bridges", difficulty: "easy",
    visibility: "open", createdBy: "Henning", suddenDeath: true,
  });
  const room = buildRoom(request);
  assert.equal(room.suddenDeath, true);
  assert.equal(room.shuffleAllowed, false);
  room.state.tiles = STUCK_TILES;

  const frames = [];
  const socket = { send: (frame) => frames.push(JSON.parse(frame)), deserializeAttachment: () => ({ user: "Henning", spectator: false }), serializeAttachment: () => {} };
  const instance = buildDo(room);
  instance.state.getWebSockets = () => [socket];

  await instance.webSocketMessage(socket, JSON.stringify({ type: "stuck" }));

  assert.ok(room.completedAt);
  assert.equal(room.state.state, "completed");
  assert.equal(frames.at(-1).type, "room-sync");
});

test("sudden death ignores a stuck report when moves are actually still available", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges", mode: "shared", layoutId: "two-bridges", difficulty: "easy",
    visibility: "open", createdBy: "Henning", suddenDeath: true,
  });
  const room = buildRoom(request); // a freshly generated board always has a move
  const socket = { send: () => {}, deserializeAttachment: () => ({ user: "Henning", spectator: false }), serializeAttachment: () => {} };
  const instance = buildDo(room);

  await instance.webSocketMessage(socket, JSON.stringify({ type: "stuck" }));

  assert.equal(room.completedAt, null);
});

test("sudden death marks a stuck racer out without ending the race for others", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges", mode: "race", layoutId: "two-bridges", difficulty: "easy",
    visibility: "open", createdBy: "Henning", suddenDeath: true,
  });
  const room = buildRoom(request);
  room.racers.Christie = { tiles: JSON.parse(JSON.stringify(room.racers.Henning.tiles)), stuckOut: false };
  room.racers.Henning.tiles = STUCK_TILES;

  const frames = [];
  const socket = { send: (frame) => frames.push(JSON.parse(frame)), deserializeAttachment: () => ({ user: "Henning", spectator: false }), serializeAttachment: () => {} };
  const instance = buildDo(room);
  instance.state.getWebSockets = () => [socket];

  await instance.webSocketMessage(socket, JSON.stringify({ type: "race-stuck" }));

  assert.equal(room.racers.Henning.stuckOut, true);
  assert.equal(room.completedAt, null); // Christie can still finish
  assert.equal(frames.at(-1).type, "race-racer-stuck");
  assert.equal(frames.at(-1).completed, false);
});

test("sudden death ends a race once every remaining racer is stuck", async () => {
  const request = validateCreateRoom({
    title: "Two Bridges", mode: "race", layoutId: "two-bridges", difficulty: "easy",
    visibility: "open", createdBy: "Henning", suddenDeath: true,
  });
  const room = buildRoom(request);
  room.racers.Christie = { tiles: [{ id: "c1", x: 0, y: 0, z: 0, face: { id: "bamboo-3" } }], stuckOut: true };
  room.racers.Henning.tiles = STUCK_TILES;

  const frames = [];
  const socket = { send: (frame) => frames.push(JSON.parse(frame)), deserializeAttachment: () => ({ user: "Henning", spectator: false }), serializeAttachment: () => {} };
  const instance = buildDo(room);
  instance.state.getWebSockets = () => [socket];

  await instance.webSocketMessage(socket, JSON.stringify({ type: "race-stuck" }));

  assert.equal(room.racers.Henning.stuckOut, true);
  assert.ok(room.completedAt);
  assert.equal(frames.at(-1).completed, true);
});

test("open-room reads filter in D1 before loading board payloads", async () => {
  const prepared = [];
  const db = {
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
      };
      prepared.push(statement);
      return statement;
    },
    async batch(statements) {
      assert.match(statements[1].sql, /WHERE visibility = \?/);
      assert.deepEqual(statements[1].values, ["open", "completed"]);
      return [
        { results: [{ name: "Henning", hue: 155, created_at: "2026-08-13T00:00:00Z", settings_json: "{}" }] },
        { results: [] },
      ];
    },
  };

  const data = await loadData(db, "open", "Christie");
  assert.ok(data.users.Henning);
  assert.deepEqual(data.rooms, {});
});
