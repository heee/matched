import test from "node:test";
import assert from "node:assert/strict";
import { continuePlayingRooms, hasStartedRoom, openRoomsForUser, randomRoomSample } from "../game/room-lists.js";

function room(overrides = {}) {
  return {
    id: "room-1",
    mode: "shared",
    visibility: "open",
    createdBy: "Alex",
    players: ["Alex"],
    botNames: [],
    state: { state: "open" },
    ...overrides,
  };
}

test("continue playing excludes the active and completed rooms", () => {
  const rooms = [
    room({ id: "active", players: ["Sam"] }),
    room({ id: "waiting", players: ["Sam"], pairsCleared: { Sam: 1 } }),
    room({ id: "done", players: ["Sam"], state: { state: "completed" } }),
    room({ id: "someone-else" }),
  ];
  assert.deepEqual(continuePlayingRooms(rooms, "Sam", "active").map((r) => r.id), ["waiting"]);
});

test("continue playing requires the current user to have created or played the room", () => {
  const rooms = [
    room({ id: "created", createdBy: "Sam", players: ["Sam"], pairsCleared: { Sam: 0 } }),
    room({ id: "played", players: ["Alex", "Sam"], pairsCleared: { Sam: 1 } }),
    room({ id: "joined-only", players: ["Alex", "Sam"], pairsCleared: { Sam: 0 } }),
  ];

  assert.equal(hasStartedRoom(rooms[0], "Sam"), true);
  assert.deepEqual(continuePlayingRooms(rooms, "Sam", null).map((r) => r.id), ["created", "played"]);
});

test("a committed first-pair membership stays started even if the pair is later undone", () => {
  const committed = room({
    id: "committed",
    players: ["Alex", "Sam"],
    startedPlayers: ["Sam"],
    pairsCleared: { Sam: 0 },
  });

  assert.equal(hasStartedRoom(committed, "Sam"), true);
  assert.deepEqual(continuePlayingRooms([committed], "Sam", null).map((r) => r.id), ["committed"]);
});

test("open rooms require another registered human creator and a joinable mode", () => {
  const users = { Alex: {}, Sam: {}, You: {} };
  const rooms = [
    room({ id: "valid" }),
    room({ id: "bot-created", createdBy: "Bot", players: ["Bot"], botNames: ["Bot"] }),
    room({ id: "unknown-creator", createdBy: "Ghost", players: ["Ghost"] }),
    room({ id: "placeholder-creator", createdBy: "You", players: ["You"] }),
    room({ id: "solo", mode: "solo" }),
    room({ id: "mine", players: ["Alex", "Sam"], pairsCleared: { Sam: 1 } }),
    room({ id: "joined-only", players: ["Alex", "Sam"], pairsCleared: { Sam: 0 } }),
    room({ id: "mine-with-stale-players", createdBy: "Sam", players: ["Alex"] }),
    room({ id: "private", visibility: "private" }),
  ];
  assert.deepEqual(openRoomsForUser(rooms, users, "Sam").map((r) => r.id), ["valid", "joined-only"]);
});

test("open-room sampling shuffles without mutating and limits the home list to three", () => {
  const rooms = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  const original = rooms.map((r) => r.id);
  const randomValues = [0, 0.25, 0.5, 0.75];
  let index = 0;

  const sampled = randomRoomSample(rooms, 3, () => randomValues[index++]);

  assert.equal(sampled.length, 3);
  assert.equal(new Set(sampled.map((r) => r.id)).size, 3);
  assert.deepEqual(rooms.map((r) => r.id), original);
  assert.notDeepEqual(sampled.map((r) => r.id), original.slice(0, 3));
});
