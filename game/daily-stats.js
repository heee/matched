import { roomElapsedSeconds } from "./ranking.js";

function timestampMs(value) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function localDayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function completedDayStats(rooms, user, now = new Date()) {
  const { startMs, endMs } = localDayBounds(now);
  let boards = 0;
  let pairs = 0;
  let timedBoards = 0;
  let timeS = 0;
  let bestStreak = 0;

  for (const room of Object.values(rooms || {})) {
    const completedMs = timestampMs(room?.completedAt);
    const players = Array.isArray(room?.players) ? room.players : [];
    if (completedMs == null || completedMs < startMs || completedMs >= endMs || !players.includes(user)) continue;

    boards += 1;
    pairs += Number(room.pairsCleared?.[user]) || 0;
    bestStreak = Math.max(bestStreak, Number(room.peakStreaks?.[user]) || Number(room.streaks?.[user]) || 0);
    const elapsedS = roomElapsedSeconds(room);
    if (elapsedS != null) {
      timeS += elapsedS;
      timedBoards += 1;
    }
  }

  return {
    boards,
    pairs,
    bestStreak,
    avgTimeS: timedBoards ? Math.round(timeS / timedBoards) : null,
  };
}

// Oldest-to-newest snapshots for the home card's seven-day context. Local
// noon keeps DST transitions from shifting a requested calendar day.
export function completedWeekStats(rooms, user, now = new Date()) {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    days.push({ date, ...completedDayStats(rooms, user, date) });
  }
  return days;
}
