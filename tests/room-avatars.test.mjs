import test from "node:test";
import assert from "node:assert/strict";
import { continueAvatarEntries } from "../game/room-avatars.js";

test("shared continue cards show every player in seat order", () => {
  const room = { mode: "shared", createdBy: "Henning", players: ["Henning", "Christie"] };
  assert.deepEqual(continueAvatarEntries(room, "Henning"), [
    { name: "Henning", seat: 0 },
    { name: "Christie", seat: 1 },
  ]);
});

test("solo continue cards show the creator rather than an open-seat placeholder", () => {
  const room = { mode: "solo", createdBy: "Henning", players: ["Henning"] };
  assert.deepEqual(continueAvatarEntries(room, "Henning"), [{ name: "Henning", seat: 0 }]);
});

test("multiplayer continue cards retain an open-seat placeholder while waiting", () => {
  const room = { mode: "shared", createdBy: "Henning", players: ["Henning"] };
  assert.deepEqual(continueAvatarEntries(room, "Henning"), [
    { name: "Henning", seat: 0 },
    { name: "?", seat: 1, open: true },
  ]);
});
