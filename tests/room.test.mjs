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
  assert.equal(shared.startedAt, null);
  assert.equal(solo.startedAt, null);
});

test("sudden death forces shuffle off, even if shuffle was requested on", () => {
  const room = buildLocalRoom({ ...baseRoom, createdBy: "Alex", suddenDeath: true, shuffleAllowed: true });
  assert.equal(room.suddenDeath, true);
  assert.equal(room.shuffleAllowed, false);
});

test("sudden death defaults off and leaves shuffle as requested", () => {
  const room = buildLocalRoom({ ...baseRoom, createdBy: "Alex", shuffleAllowed: true });
  assert.equal(room.suddenDeath, false);
  assert.equal(room.shuffleAllowed, true);
});

test("race mode racers start with stuckOut false", () => {
  const room = buildLocalRoom({ ...baseRoom, createdBy: "Alex", mode: "race" });
  assert.equal(room.racers.Alex.stuckOut, false);
});
