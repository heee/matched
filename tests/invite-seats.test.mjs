import test from "node:test";
import assert from "node:assert/strict";
import { inviteSeatEntries } from "../game/invite-seats.js";

test("invite seats include humans who already joined on another device", () => {
  const room = {
    players: ["Henning", "Bamboo", "Christie"],
    botNames: ["Bamboo"],
    botDifficulty: { Bamboo: "hard" },
  };
  assert.deepEqual(inviteSeatEntries(room, "Henning", ["Christie", "Dana"]), [
    { name: "Bamboo", kind: "bot", difficulty: "hard" },
    { name: "Christie", kind: "joined", difficulty: null },
    { name: "Dana", kind: "invited", difficulty: null },
  ]);
});
