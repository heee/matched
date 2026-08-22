import test from "node:test";
import assert from "node:assert/strict";
import {
  continuePlayingRooms,
  hasStartedRoom,
  openRoomsForUser,
  randomRoomSample,
  shouldAbandonRoomOnExit,
  waitingForPlayersRooms,
} from "../game/room-lists.js";

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

test("continue playing includes the current room and excludes completed rooms", () => {
  const rooms = [
    room({ id: "active", players: ["Sam"], startedPlayers: ["Sam"], state: { state: "in_progress" } }),
    room({ id: "waiting", players: ["Sam"], pairsCleared: { Sam: 1 } }),
    room({ id: "done", players: ["Sam"], state: { state: "completed" } }),
    room({ id: "someone-else" }),
  ];
  assert.deepEqual(continuePlayingRooms(rooms, "Sam").map((r) => r.id), ["active", "waiting"]);
});

test("continue playing requires actual committed progress, not room creation", () => {
  const rooms = [
    room({ id: "created", createdBy: "Sam", players: ["Sam"], pairsCleared: { Sam: 0 } }),
    room({ id: "played", players: ["Alex", "Sam"], pairsCleared: { Sam: 1 } }),
    room({ id: "joined-only", players: ["Alex", "Sam"], pairsCleared: { Sam: 0 } }),
  ];

  assert.equal(hasStartedRoom(rooms[0], "Sam"), false);
  assert.deepEqual(continuePlayingRooms(rooms, "Sam").map((r) => r.id), ["played"]);
});

test("a creator can continue once anyone has progressed the board", () => {
  const progressed = room({
    id: "progressed",
    createdBy: "Sam",
    players: ["Sam", "Alex"],
    pairsCleared: { Sam: 0, Alex: 1 },
    state: { state: "in_progress" },
  });

  assert.equal(hasStartedRoom(progressed, "Sam"), true);
  assert.deepEqual(continuePlayingRooms([progressed], "Sam").map((r) => r.id), ["progressed"]);
});

test("zero-progress multiplayer rooms with a waiting reason stay separate", () => {
  const rooms = [
    room({ id: "open", createdBy: "Sam", players: ["Sam"], pairsCleared: { Sam: 0 } }),
    room({ id: "invited", createdBy: "Sam", visibility: "private", players: ["Sam"], pairsCleared: { Sam: 0 } }),
    room({ id: "private", createdBy: "Sam", visibility: "private", players: ["Sam"], pairsCleared: { Sam: 0 } }),
    room({ id: "solo", createdBy: "Sam", mode: "solo", players: ["Sam"], pairsCleared: { Sam: 0 } }),
  ];
  const invites = [{ roomId: "invited", toUser: "Alex" }];

  assert.deepEqual(waitingForPlayersRooms(rooms, "Sam", null, invites).map((r) => r.id), ["open", "invited"]);
  assert.equal(shouldAbandonRoomOnExit(rooms[0], "Sam", invites), false);
  assert.equal(shouldAbandonRoomOnExit(rooms[2], "Sam", invites), true);
  assert.equal(shouldAbandonRoomOnExit(rooms[3], "Sam", invites), true);
});

test("a committed first-pair membership stays started even if the pair is later undone", () => {
  const committed = room({
    id: "committed",
    players: ["Alex", "Sam"],
    startedPlayers: ["Sam"],
    pairsCleared: { Sam: 0 },
    state: { state: "in_progress" },
  });

  assert.equal(hasStartedRoom(committed, "Sam"), true);
  assert.deepEqual(continuePlayingRooms([committed], "Sam").map((r) => r.id), ["committed"]);
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
