import test from "node:test";
import assert from "node:assert/strict";
import { elapsedMsSince, roomTimerStartMs, timestampMs } from "../game/time.js";

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
