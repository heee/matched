import test from "node:test";
import assert from "node:assert/strict";
import { RoomDO, buildRoom, validateCreateRoom } from "../worker/index.js";

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
  assert.deepEqual(room.players, ["Henning", "Bamboo"]);
  assert.deepEqual(room.botNames, ["Bamboo"]);
  assert.equal(room.botDifficulty.Bamboo, "hard");
});
