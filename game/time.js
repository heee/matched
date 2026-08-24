export function timestampMs(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function elapsedMsSince(startedAt, now = Date.now()) {
  const startMs = timestampMs(startedAt);
  return startMs == null ? null : Math.max(0, now - startMs);
}

// Shared and race rooms can sit in the invite sheet for hours before anybody
// plays. Their board clock begins with the first successful match, not at
// room creation. The match log also repairs legacy rooms that stored
// createdAt as startedAt before this rule was introduced.
export function roomTimerStartMs(room) {
  const stored = timestampMs(room?.startedAt);
  if (room?.mode !== "shared" && room?.mode !== "race") return stored;
  const firstMatch = (room?.state?.matchLog || [])
    .map((entry) => timestampMs(entry?.at))
    .find((value) => value != null);
  return firstMatch ?? null;
}

// A room's clock should only run while someone actually has the board open —
// a shared/race room left sitting for hours between matches must not count
// that idle time. `room.activeMs` accumulates closed viewing windows;
// `room.activeWindow` (null when nobody's watching) holds the currently-open
// one. For shared/race rooms this pair is server-authoritative (the Worker's
// RoomDO unions visibility across every connected player and broadcasts
// updates); for solo play there's only one device, so the board screen
// manages these fields itself via document.visibilitychange.
export function openActiveWindow(room, now = Date.now()) {
  if (room && !room.activeWindow) room.activeWindow = { startedAt: now };
}

export function closeActiveWindow(room, now = Date.now()) {
  if (room?.activeWindow) {
    room.activeMs = (room.activeMs || 0) + Math.max(0, now - room.activeWindow.startedAt);
    room.activeWindow = null;
  }
}

export function currentActiveMs(room, now = Date.now()) {
  const base = room?.activeMs || 0;
  return room?.activeWindow ? base + Math.max(0, now - room.activeWindow.startedAt) : base;
}
