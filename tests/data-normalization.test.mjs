import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFace, normalizeRoomData } from "../game/room-normalize.js";
import { isActualPlayerName, repairCurrentPlayerAliases } from "../game/identity.js";

test("legacy id-only faces are hydrated from the canonical catalog", () => {
  assert.deepEqual(normalizeFace({ id: "dot5" }), {
    id: "dot5", kind: "dot", n: 5, color: "#b5322c",
  });
});

test("unknown malformed faces render a visible fallback instead of blank", () => {
  assert.equal(normalizeFace({ id: "old-face" }).top, "?");
});

test("room normalization repairs board, tray, and racer tile faces", () => {
  const room = normalizeRoomData({
    state: {
      tiles: [{ id: "t1", face: { id: "bam3" } }],
      tray: [{ face: "wind0", user: "Alex" }],
    },
    racers: { Alex: { tiles: [{ id: "r1", face: { id: "crak2" } }] } },
  });
  assert.equal(room.state.tiles[0].face.kind, "bam");
  assert.equal(room.state.tray[0].face.kind, "char");
  assert.equal(room.racers.Alex.tiles[0].face.kind, "char");
});

test("display-only identities are not actual players", () => {
  assert.equal(isActualPlayerName("You"), false);
  assert.equal(isActualPlayerName("anonymous"), false);
  assert.equal(isActualPlayerName("Henning"), true);
});

test("legacy You and case aliases collapse into the current player", () => {
  const room = {
    createdBy: "You",
    players: ["You", "henning", "Henning"],
    botNames: [],
    pairsCleared: { You: 2, henning: 1, Henning: 0 },
    streaks: { You: 1 },
    assistsUsed: {},
    state: { tray: [{ user: "You" }], matchLog: [{ user: "henning" }] },
    racers: { You: { tiles: [] } },
  };
  assert.equal(repairCurrentPlayerAliases(room, "Henning"), true);
  assert.deepEqual(room.players, ["Henning"]);
  assert.equal(room.createdBy, "Henning");
  assert.equal(room.pairsCleared.Henning, 2);
  assert.equal(room.state.tray[0].user, "Henning");
  assert.equal(room.state.matchLog[0].user, "Henning");
  assert.ok(room.racers.Henning);
});
