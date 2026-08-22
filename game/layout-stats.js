import { LAYOUT_LEVELS_STARTED_AT } from "./layout-levels.js";

export function completedLayoutStats(rooms, user, { since = LAYOUT_LEVELS_STARTED_AT } = {}) {
  const byLayout = {};
  const sinceMs = typeof since === "number" ? since : Date.parse(since);
  for (const room of Object.values(rooms || {})) {
    const players = Array.isArray(room?.players) ? room.players : [];
    if (!room?.completedAt || !room.layoutId || !players.includes(user)) continue;
    if (Number.isFinite(sinceMs) && Date.parse(room.completedAt) < sinceMs) continue;
    const stats = byLayout[room.layoutId] || { boards: 0, pairs: 0 };
    stats.boards += 1;
    stats.pairs += Number(room.pairsCleared?.[user]) || 0;
    byLayout[room.layoutId] = stats;
  }
  return byLayout;
}
