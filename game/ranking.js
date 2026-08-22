// Ranking aggregation stays DOM-free so persistence and date edge cases are
// covered without rendering the screen.

export const RANKING_METRICS = [
  { id: "pairs", label: "Pairs", fullLabel: "Pairs cleared" },
  { id: "speed", label: "Speed", fullLabel: "Speed to clear" },
  { id: "share", label: "Share", fullLabel: "Board completion share" },
];

export function rankingPeriodStartMs(period, now = Date.now()) {
  if (period === "Today") return now - 24 * 3600 * 1000;
  if (period === "Week") return now - 7 * 24 * 3600 * 1000;
  if (period === "Month") return now - 30 * 24 * 3600 * 1000;
  return 0;
}

function timestampMs(value) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function aggregateRankings(rooms, period, now = Date.now()) {
  const since = rankingPeriodStartMs(period, now);
  const byPlayer = new Map();
  for (const room of Object.values(rooms || {})) {
    const completedMs = timestampMs(room?.completedAt);
    if (completedMs == null || completedMs < since) continue;
    const totalPairs = Number(room.tileCount) / 2;
    const startedMs = timestampMs(room.startedAt);
    const elapsedS = startedMs == null ? null : Math.max(1, Math.round((completedMs - startedMs) / 1000));
    const botNames = new Set(room.botNames || []);
    const players = Array.isArray(room.players) ? room.players : Object.keys(room.pairsCleared || {});
    for (const name of players) {
      if (!name || botNames.has(name)) continue;
      if (!byPlayer.has(name)) byPlayer.set(name, { name, boards: 0, timedBoards: 0, pairs: 0, timeS: 0, share: 0 });
      const aggregate = byPlayer.get(name);
      const pairs = Number(room.pairsCleared?.[name]) || 0;
      aggregate.boards += 1;
      aggregate.pairs += pairs;
      if (elapsedS != null) {
        aggregate.timeS += elapsedS;
        aggregate.timedBoards += 1;
      }
      aggregate.share += totalPairs > 0 ? (pairs / totalPairs) * 100 : 0;
    }
  }
  return [...byPlayer.values()];
}

export function rankingMetricValue(row, metric) {
  if (metric === "pairs") return row.pairs;
  if (metric === "speed") return row.timedBoards ? Math.round(row.timeS / row.timedBoards) : 0;
  if (metric === "share") return row.boards ? Math.round(row.share / row.boards) : 0;
  return 0;
}
