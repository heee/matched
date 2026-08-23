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

test("daily completion reports only the active user's measured result", async () => {
  let request;
  const api = createWorkerApi({
    baseUrl: "https://example.test",
    appKey: "test-key",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  const result = { date: "2026-08-22", user: "Henning", elapsedMs: 154000, pairsMatched: 26 };
  await api.reportDailyResult(result);
  assert.equal(request.url, "https://example.test/daily-result");
  assert.deepEqual(JSON.parse(request.options.body), result);
});

test("invite picker can refresh the registered-user directory without loading rooms", async () => {
  let requestUrl;
  const api = createWorkerApi({
    baseUrl: "https://example.test",
    appKey: "test-key",
    fetchImpl: async (url) => {
      requestUrl = url;
      return new Response(JSON.stringify({ users: { Christie: {} }, rooms: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const data = await api.fetchUsers();
  assert.equal(requestUrl, "https://example.test/data?scope=users");
  assert.ok(data.users.Christie);
});
