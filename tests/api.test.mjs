import test from "node:test";
import assert from "node:assert/strict";
import { createWorkerApi } from "../api.js";

test("joining a room tells the Worker that the first pair was cleared", async () => {
  let request;
  const api = createWorkerApi({
    baseUrl: "https://example.test",
    appKey: "test-key",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await api.joinRoom("room-1", "Sam");

  assert.equal(request.url, "https://example.test/join-room");
  assert.deepEqual(JSON.parse(request.options.body), { roomId: "room-1", user: "Sam", started: true });
});
