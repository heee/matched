import test from "node:test";
import assert from "node:assert/strict";
import { buildLocalRoom } from "../game/room.js";

const baseRoom = {
  title: "Test room",
  mode: "shared",
  layoutId: "two-bridges",
  difficulty: "easy",
  visibility: "open",
};

test("room creation requires a human creator", () => {
  assert.throws(() => buildLocalRoom(baseRoom), /human creator/i);
  assert.throws(() => buildLocalRoom({ ...baseRoom, createdBy: "You" }), /human creator/i);
});

test("a bot seat cannot also be the room creator", () => {
  assert.throws(() => buildLocalRoom({
    ...baseRoom,
    createdBy: "Bamboo",
    bots: [{ name: "Bamboo", difficulty: "medium" }],
  }), /bot cannot create/i);
});

test("bots remain optional seats in a human-created room", () => {
  const room = buildLocalRoom({
    ...baseRoom,
    createdBy: "Alex",
    bots: [{ name: "Bamboo", difficulty: "medium" }],
  });
  assert.equal(room.createdBy, "Alex");
  assert.deepEqual(room.botNames, ["Bamboo"]);
  assert.deepEqual(room.players, ["Alex", "Bamboo"]);
});

test("new rooms begin ready or waiting, not in progress", () => {
  const shared = buildLocalRoom({ ...baseRoom, createdBy: "Alex" });
  const solo = buildLocalRoom({ ...baseRoom, createdBy: "Alex", mode: "solo" });
  assert.equal(shared.state.state, "waiting");
  assert.equal(solo.state.state, "ready");
});
