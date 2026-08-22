import test from "node:test";
import assert from "node:assert/strict";
import { mergeSharedData } from "../storage.js";

function room(completedAt) {
  return { players: ["A"], pairsCleared: { A: completedAt ? 2 : 0 }, state: { tiles: [], tray: [], matchLog: [] }, completedAt };
}

test("remote hydration preserves a locally completed room over an open snapshot", () => {
  const completed = room("2026-08-22T12:00:00.000Z");
  const merged = mergeSharedData({ rooms: { same: completed } }, { rooms: { same: room(null) } });
  assert.equal(merged.rooms.same.completedAt, completed.completedAt);
  assert.equal(merged.rooms.same.pairsCleared.A, 2);
});

test("remote completed rooms replace local open snapshots", () => {
  const completed = room("2026-08-22T12:00:00.000Z");
  const merged = mergeSharedData({ rooms: { same: room(null) } }, { rooms: { same: completed } });
  assert.equal(merged.rooms.same.completedAt, completed.completedAt);
});
