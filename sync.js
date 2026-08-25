// Matched — reconciliation: retries anything queued locally from failed
// writes. Same shape as Boys Pushup Bonanza's sync.js.

import { isRetryableError } from "./api.js";

const QUEUED_TYPES = new Set(["create-room", "join-room", "update-room", "complete-room", "register-user", "daily-result", "update-user-color"]);

function fallbackId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeQueue(value, now = () => Date.now()) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    if (QUEUED_TYPES.has(item.type) && item.payload && typeof item.payload === "object") {
      return [{ attempts: 0, createdAt: now(), ...item }];
    }
    return [];
  });
}

export function createMutationQueue({ jsonStorage, key, now = () => Date.now(), idFactory = fallbackId }) {
  const read = () => normalizeQueue(jsonStorage.read(key, []), now);
  const write = (operations) => jsonStorage.write(key, operations);

  function enqueue(type, payload, { id } = {}) {
    if (!QUEUED_TYPES.has(type)) throw new Error(`Unsupported queued mutation: ${type}`);
    const operations = read();
    const operation = { id: id || `${type}:${idFactory()}`, type, payload, createdAt: now(), attempts: 0 };
    const existing = operations.findIndex((entry) => entry.id === operation.id);
    if (existing === -1) operations.push(operation);
    else operations[existing] = { ...operations[existing], payload };
    write(operations);
    return operation;
  }

  async function flush(send) {
    const operations = read();
    const remaining = [];
    let flushed = 0;
    let failed = 0;
    for (const operation of operations) {
      try {
        await send(operation);
        flushed += 1;
      } catch (error) {
        failed += 1;
        if (isRetryableError(error)) {
          remaining.push({ ...operation, attempts: operation.attempts + 1, lastAttemptAt: now() });
        }
      }
    }
    write(remaining);
    return { flushed, failed, remaining: remaining.length };
  }

  return { read, write, enqueue, flush };
}

// Reconnecting WebSocket wrapper for the live room. Exponential backoff,
// caps at 8s, resubscribes automatically. Kept dependency-free so it works
// the same in the browser and (mocked) in tests.
// How often to ping while connected. Well under the Worker's
// STALE_SOCKET_MS (90s) so a merely-idle-but-alive tab never gets evicted;
// its only job is to keep the DO's per-socket lastSeen fresh so a dead
// connection (network loss, OS-killed app, laptop sleep — anything that
// doesn't fire a clean close/error event) gets noticed instead of leaving
// the room clock running against nobody forever.
const HEARTBEAT_MS = 20_000;

export function createRoomSocket({ url, onMessage, onOpen, onClose, wsFactory = (u) => new WebSocket(u) }) {
  let socket = null;
  let closedByUser = false;
  let backoffMs = 500;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  const pending = [];

  function connect() {
    closedByUser = false;
    socket = wsFactory(url);
    socket.addEventListener("open", () => {
      backoffMs = 500;
      while (pending.length && socket.readyState === 1) socket.send(pending.shift());
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => send({ type: "ping" }), HEARTBEAT_MS);
      onOpen?.();
    });
    socket.addEventListener("message", (evt) => {
      try {
        onMessage?.(JSON.parse(evt.data));
      } catch (e) {
        // ignore malformed frames
      }
    });
    socket.addEventListener("close", () => {
      clearInterval(heartbeatTimer);
      onClose?.();
      if (closedByUser) return;
      reconnectTimer = setTimeout(connect, backoffMs);
      backoffMs = Math.min(8000, backoffMs * 2);
    });
    socket.addEventListener("error", () => {
      try { socket.close(); } catch (e) {}
    });
  }

  function send(msg) {
    const payload = JSON.stringify(msg);
    if (socket && socket.readyState === 1) socket.send(payload);
    else pending.push(payload);
    return true;
  }

  function close() {
    closedByUser = true;
    clearTimeout(reconnectTimer);
    clearInterval(heartbeatTimer);
    pending.length = 0;
    try { socket?.close(1000, "client closed"); } catch (e) {}
  }

  connect();
  return { send, close };
}
