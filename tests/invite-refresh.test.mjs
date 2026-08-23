import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../screens/invite.js", import.meta.url), "utf8");

test("invite screen polls focused room membership and cleans up on navigation", () => {
  assert.match(source, /ctx\.refreshRoom\(room\.id\)/);
  assert.match(source, /setInterval\(refreshJoinedPlayers, 5000\)/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /clearInterval\(refreshTimer\)/);
});
