import test from "node:test";
import assert from "node:assert/strict";
import { elapsedMsSince, roomTimerStartMs, timestampMs, openActiveWindow, closeActiveWindow, currentActiveMs } from "../game/time.js";

test("timestampMs accepts numeric and ISO room start times", () => {
  assert.equal(timestampMs(1_750_000_000_000), 1_750_000_000_000);
  assert.equal(timestampMs("1750000000000"), 1_750_000_000_000);
  assert.equal(timestampMs("2026-08-22T18:00:00.000Z"), Date.parse("2026-08-22T18:00:00.000Z"));
});

test("elapsedMsSince rejects missing starts and clamps future starts", () => {
  assert.equal(elapsedMsSince(null, 5_000), null);
  assert.equal(elapsedMsSince("not-a-date", 5_000), null);
  assert.equal(elapsedMsSince(4_000, 5_000), 1_000);
  assert.equal(elapsedMsSince(6_000, 5_000), 0);
});

test("shared room clocks start at the first match instead of room creation", () => {
  const firstMatchAt = Date.parse("2026-08-23T20:44:21.330Z");
  assert.equal(roomTimerStartMs({
    mode: "shared",
    startedAt: Date.parse("2026-08-23T00:39:47.256Z"),
    state: { matchLog: [{ user: "Christie", at: firstMatchAt }] },
  }), firstMatchAt);
  assert.equal(roomTimerStartMs({ mode: "shared", startedAt: 1000, state: { matchLog: [] } }), null);
  assert.equal(roomTimerStartMs({ mode: "solo", startedAt: 1000, state: { matchLog: [] } }), 1000);
});

test("race room clocks also start at the first match, not invite time", () => {
  const firstMatchAt = Date.parse("2026-08-23T20:44:21.330Z");
  assert.equal(roomTimerStartMs({
    mode: "race",
    startedAt: Date.parse("2026-08-23T00:39:47.256Z"),
    state: { matchLog: [{ user: "Christie", at: firstMatchAt }] },
  }), firstMatchAt);
  assert.equal(roomTimerStartMs({ mode: "race", startedAt: 1000, state: { matchLog: [] } }), null);
});

test("active window accumulates only the time it was open, ignoring gaps", () => {
  const room = { activeMs: 0, activeWindow: null };
  openActiveWindow(room, 1000);
  assert.equal(currentActiveMs(room, 4000), 3000); // still open, ticking live
  closeActiveWindow(room, 5000);
  assert.equal(room.activeMs, 4000);
  assert.equal(room.activeWindow, null);
  // a long idle gap with no open window must not be counted
  openActiveWindow(room, 50_000);
  assert.equal(currentActiveMs(room, 51_000), 5000); // 4000 banked + 1000 of this window
  closeActiveWindow(room, 51_000);
  assert.equal(room.activeMs, 5000);
});

test("opening/closing an already-open/closed window is a no-op", () => {
  const room = { activeMs: 0, activeWindow: null };
  closeActiveWindow(room, 1000); // nothing open yet
  assert.equal(room.activeMs, 0);
  openActiveWindow(room, 1000);
  openActiveWindow(room, 2000); // already open — must not reset the start
  assert.equal(room.activeWindow.startedAt, 1000);
  closeActiveWindow(room, 3000);
  assert.equal(room.activeMs, 2000);
});
