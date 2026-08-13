// Matched — local persistence (localStorage cache + offline queue).
// Same division of responsibility as Boys Pushup Bonanza: storage.js only
// ever reads/writes JSON to a Storage-like object, no networking here.

export const EMPTY_SHARED_DATA = Object.freeze({
  users: {},
  rooms: {},
  invites: [],
});

export function normalizeSharedData(value) {
  const data = value && typeof value === "object" ? value : {};
  return {
    ...data,
    users: data.users && typeof data.users === "object" ? data.users : {},
    rooms: data.rooms && typeof data.rooms === "object" ? data.rooms : {},
    // Local-only for now — no server endpoint persists these across
    // devices yet, so an invite only reaches the recipient if they're on
    // the same browser/localStorage (e.g. a switched-to profile on this
    // device). Cross-device delivery would need a Worker route.
    invites: Array.isArray(data.invites) ? data.invites : [],
  };
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
  lastDailyCompleted: "matched-last-daily-completed",
  activeRoom: "matched-active-room",
};

export const DEFAULT_SETTINGS = {
  freeTilesGlow: true,
  hintsAllowed: true,
  sound: true,
  haptic: true,
};
