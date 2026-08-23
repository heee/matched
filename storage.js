// Matched — local persistence (localStorage cache + offline queue).
// Same division of responsibility as Boys Pushup Bonanza: storage.js only
// ever reads/writes JSON to a Storage-like object, no networking here.

import { isActualPlayerName } from "./game/identity.js";
import { normalizeRoomData } from "./game/room-normalize.js";

export const EMPTY_SHARED_DATA = Object.freeze({
  users: {},
  rooms: {},
  invites: [],
});

export function normalizeSharedData(value) {
  const data = value && typeof value === "object" ? value : {};
  const rawUsers = data.users && typeof data.users === "object" ? data.users : {};
  const rawRooms = data.rooms && typeof data.rooms === "object" ? data.rooms : {};
  return {
    ...data,
    users: Object.fromEntries(Object.entries(rawUsers).filter(([name]) => isActualPlayerName(name))),
    rooms: Object.fromEntries(Object.entries(rawRooms).map(([id, room]) => [id, normalizeRoomData(room)])),
    // Local-only for now — no server endpoint persists these across
    // devices yet, so an invite only reaches the recipient if they're on
    // the same browser/localStorage (e.g. a switched-to profile on this
    // device). Cross-device delivery would need a Worker route.
    invites: Array.isArray(data.invites) ? data.invites : [],
  };
}

// Remote hydration must not replace a locally completed board with the
// older open snapshot that was created before play began. Completed remote
// snapshots still win over local open copies, while other rooms use the
// latest server view.
export function mergeSharedData(localValue, remoteValue, now = Date.now()) {
  const local = normalizeSharedData(localValue);
  const remote = normalizeSharedData(remoteValue);
  const rooms = { ...local.rooms };
  // A failed/abandoned local room creation used to leave an empty waiting
  // card forever, even after a full authoritative fetch showed that room no
  // longer existed. Keep recent offline work and all played/completed rooms,
  // but retire empty orphan invitations after an hour.
  for (const [id, localRoom] of Object.entries(rooms)) {
    if (remote.rooms[id]) continue;
    const createdMs = Date.parse(localRoom?.createdAt);
    const hasProgress = Object.values(localRoom?.pairsCleared || {}).some((count) => Number(count) > 0)
      || localRoom?.state?.state === "in_progress"
      || localRoom?.state?.state === "completed";
    if (!localRoom?.completedAt && !hasProgress && Number.isFinite(createdMs) && now - createdMs > 60 * 60 * 1000) {
      delete rooms[id];
    }
  }
  for (const [id, remoteRoom] of Object.entries(remote.rooms)) {
    const localRoom = rooms[id];
    rooms[id] = localRoom?.completedAt && !remoteRoom?.completedAt ? localRoom : remoteRoom;
  }
  return normalizeSharedData({
    ...local,
    ...remote,
    users: { ...local.users, ...remote.users },
    rooms,
    invites: local.invites,
  });
}

export function createJsonStorage(storage) {
  return {
    read(key, fallback) {
      try {
        const raw = storage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      storage.setItem(key, JSON.stringify(value));
    },
    remove(key) {
      storage.removeItem(key);
    },
  };
}

export const LOCAL_KEYS = {
  currentUser: "matched-current-user",
  cacheData: "matched-cache-data",
  pendingQueue: "matched-pending-queue",
  settings: "matched-settings",
  equipped: "matched-equipped",
  points: "matched-points",
  assistUsage: "matched-assist-usage",
  dailyStreak: "matched-daily-streak",
  dailyStreaks: "matched-daily-streaks-by-user",
  lastDailyCompleted: "matched-last-daily-completed",
  dailyCompletedByUser: "matched-daily-completed-by-user",
  dailyResults: "matched-daily-results",
  activeRoom: "matched-active-room",
  activeRooms: "matched-active-rooms-by-player",
};

export const DEFAULT_SETTINGS = {
  freeTilesGlow: false,
  hintsAllowed: true,
  provideClues: true,
  sound: true,
  haptic: true,
  feltAcrossApp: true,
};
