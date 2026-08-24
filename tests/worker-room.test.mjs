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
  };
  const stored = new Map([["room", room]]);
  const state = {
    storage: {
      get: async (key) => stored.get(key),
      put: async (key, value) => stored.set(key, value),
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
  };
  const observer = {
    send: (frame) => frames.push(JSON.parse(frame)),
    deserializeAttachment: () => ({ user: "Christie", spectator: false }),
  };
  const stored = new Map([["room", room]]);
  const state = {
    storage: {
      get: async (key) => stored.get(key),
      put: async (key, value) => stored.set(key, value),
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
  };
  const observer = {
    send: (frame) => frames.push(JSON.parse(frame)),
    deserializeAttachment: () => ({ user: "Christie", spectator: false }),
  };
  const stored = new Map([["room", room]]);
  const state = {
    storage: {
      get: async (key) => stored.get(key),
      put: async (key, value) => stored.set(key, value),
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
