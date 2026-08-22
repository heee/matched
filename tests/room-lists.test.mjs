import test from "node:test";
import assert from "node:assert/strict";
import { continuePlayingRooms, openRoomsForUser } from "../game/room-lists.js";

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
    room({ id: "waiting", players: ["Sam"] }),
    room({ id: "done", players: ["Sam"], state: { state: "completed" } }),
    room({ id: "someone-else" }),
  ];
  assert.deepEqual(continuePlayingRooms(rooms, "Sam", "active").map((r) => r.id), ["waiting"]);
});

test("open rooms require another registered human creator and a joinable mode", () => {
  const users = { Alex: {}, Sam: {}, You: {} };
  const rooms = [
    room({ id: "valid" }),
    room({ id: "bot-created", createdBy: "Bot", players: ["Bot"], botNames: ["Bot"] }),
    room({ id: "unknown-creator", createdBy: "Ghost", players: ["Ghost"] }),
    room({ id: "placeholder-creator", createdBy: "You", players: ["You"] }),
    room({ id: "solo", mode: "solo" }),
    room({ id: "mine", players: ["Alex", "Sam"] }),
    room({ id: "mine-with-stale-players", createdBy: "Sam", players: ["Alex"] }),
    room({ id: "private", visibility: "private" }),
  ];
  assert.deepEqual(openRoomsForUser(rooms, users, "Sam").map((r) => r.id), ["valid"]);
});
