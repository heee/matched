import { LAYOUT_LEVELS_STARTED_AT } from "./layout-levels.js";
import { roomElapsedSeconds } from "./ranking.js";

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

// Catalog-row expand panel: fastest completed time for this layout (and who
// set it), plus this user's own play count and personal best — all-time,
// unlike completedLayoutStats above which is scoped to the level-progress
// era. "Who set it" credits whichever non-bot player cleared the most pairs
// in that room, since a shared/race room's clock is one duration for
// everyone in it rather than a per-player time.
export function layoutRecordStats(rooms, layoutId, user) {
  let timesPlayed = 0;
  let personalBestSeconds = null;
  let fastestSeconds = null;
  let fastestHolder = null;
  for (const room of Object.values(rooms || {})) {
    if (!room?.completedAt || room.layoutId !== layoutId) continue;
    const players = Array.isArray(room.players) ? room.players : [];
    const botNames = new Set(room.botNames || []);
    const elapsedS = roomElapsedSeconds(room);

    if (players.includes(user) && !botNames.has(user)) {
      timesPlayed += 1;
      if (elapsedS != null && (personalBestSeconds == null || elapsedS < personalBestSeconds)) {
        personalBestSeconds = elapsedS;
      }
    }

    if (elapsedS != null && (fastestSeconds == null || elapsedS < fastestSeconds)) {
      const humans = players.filter((p) => !botNames.has(p));
      if (humans.length) {
        const holder = humans.reduce((best, p) => {
          const pairs = Number(room.pairsCleared?.[p]) || 0;
          return pairs > (Number(room.pairsCleared?.[best]) || 0) ? p : best;
        }, humans[0]);
        fastestSeconds = elapsedS;
        fastestHolder = holder;
      }
    }
  }
  return { timesPlayed, personalBestSeconds, fastestSeconds, fastestHolder };
}
