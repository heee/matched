import { aggregateRankings, rankingPeriodStartMs } from "./ranking.js";

function timestampMs(value) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function headToHeadStats(rooms, currentUser, opponent, period, now = Date.now()) {
  const rankings = new Map(aggregateRankings(rooms, period, now).map((row) => [row.name, row]));
  const since = rankingPeriodStartMs(period, now);
  const names = [currentUser, opponent];
  const players = names.map((name) => {
    const aggregate = rankings.get(name) || { boards: 0, pairs: 0, share: 0 };
    let bestStreak = 0;
    for (const room of Object.values(rooms || {})) {
      const completedMs = timestampMs(room?.completedAt);
      if (completedMs == null || completedMs < since || !room.players?.includes(name) || room.botNames?.includes(name)) continue;
      bestStreak = Math.max(bestStreak, Number(room.peakStreaks?.[name]) || Number(room.streaks?.[name]) || 0);
    }
    return {
      name,
      boards: aggregate.boards || 0,
      pairs: aggregate.pairs || 0,
      share: aggregate.boards ? Math.round(aggregate.share / aggregate.boards) : 0,
      bestStreak,
    };
  });

  const together = { boards: 0, currentWins: 0, opponentWins: 0, ties: 0 };
  for (const room of Object.values(rooms || {})) {
    const completedMs = timestampMs(room?.completedAt);
    if (completedMs == null || completedMs < since || !room.players?.includes(currentUser) || !room.players?.includes(opponent)) continue;
    if (room.botNames?.includes(currentUser) || room.botNames?.includes(opponent)) continue;
    together.boards += 1;
    const currentPairs = Number(room.pairsCleared?.[currentUser]) || 0;
    const opponentPairs = Number(room.pairsCleared?.[opponent]) || 0;
    if (currentPairs > opponentPairs) together.currentWins += 1;
    else if (opponentPairs > currentPairs) together.opponentWins += 1;
    else together.ties += 1;
  }

  return { players, together };
}
