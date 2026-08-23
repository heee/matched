import test from "node:test";
import assert from "node:assert/strict";
import { createRoomSocket } from "../sync.js";

class FakeSocket {
  constructor() {
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  emit(type, event = {}) {
    this.listeners.get(type)?.(event);
  }

  send(payload) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = 3;
  }
}

test("room socket queues a move until the live connection opens", () => {
  const fake = new FakeSocket();
  const roomSocket = createRoomSocket({ url: "wss://example.test/room/one/connect", wsFactory: () => fake });

  roomSocket.send({ type: "clear-pair", idA: "a", idB: "b" });
  assert.deepEqual(fake.sent, []);

  fake.readyState = 1;
  fake.emit("open");
  assert.deepEqual(fake.sent.map(JSON.parse), [{ type: "clear-pair", idA: "a", idB: "b" }]);
  roomSocket.close();
});

test("room socket parses authoritative room events", () => {
  const fake = new FakeSocket();
  const received = [];
  const roomSocket = createRoomSocket({
    url: "wss://example.test/room/one/connect",
    wsFactory: () => fake,
    onMessage: (message) => received.push(message),
  });

  fake.emit("message", { data: JSON.stringify({ type: "cleared", user: "Christie" }) });
  assert.deepEqual(received, [{ type: "cleared", user: "Christie" }]);
  roomSocket.close();
});
