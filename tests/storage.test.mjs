import test from "node:test";
import assert from "node:assert/strict";
import { createJsonStorage, DEFAULT_SETTINGS, mergeSharedData, writeRoomCache } from "../storage.js";

test("automatic board resizing is enabled by default", () => {
  assert.equal(DEFAULT_SETTINGS.autoResizeBoard, true);
});

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

test("authoritative hydration retires stale empty local-only waiting rooms", () => {
  const now = Date.parse("2026-08-23T12:00:00.000Z");
  const stale = room(null);
  stale.createdAt = "2026-08-23T08:00:00.000Z";
  stale.pairsCleared = { A: 0 };
  stale.state = { state: "waiting" };
  const recent = { ...stale, id: "recent", createdAt: "2026-08-23T11:30:00.000Z" };

  const merged = mergeSharedData({ rooms: { stale, recent } }, { rooms: {} }, now);

  assert.equal(merged.rooms.stale, undefined);
  assert.equal(merged.rooms.recent.id, "recent");
});

test("storage quota failures are reported instead of escaping into gameplay", () => {
  const storage = {
    getItem: () => null,
    setItem: () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); },
    removeItem: () => {},
  };
  const jsonStorage = createJsonStorage(storage);

  assert.equal(jsonStorage.write("cache", { rooms: {} }), false);
  assert.equal(jsonStorage.remove("cache"), true);
});

test("oversized room caches fall back to rooms relevant to the active player", () => {
  let saved = null;
  const storage = {
    getItem: () => null,
    setItem: (_key, value) => {
      if (value.length > 700) throw new DOMException("Quota exceeded", "QuotaExceededError");
      saved = value;
    },
    removeItem: () => {},
  };
  const jsonStorage = createJsonStorage(storage);
  const makeRoom = (id, createdBy, padding) => ({ id, createdBy, players: [createdBy], state: { tiles: padding } });
  const store = {
    users: { Christie: {}, Henning: {} },
    invites: [],
    rooms: {
      christie: makeRoom("christie", "Christie", "x".repeat(100)),
      henning: makeRoom("henning", "Henning", "x".repeat(1000)),
    },
  };

  assert.equal(writeRoomCache(jsonStorage, "cache", store, { currentUser: "Christie", activeRoomId: "christie" }), true);
  const cached = JSON.parse(saved);
  assert.deepEqual(Object.keys(cached.rooms), ["christie"]);
});
