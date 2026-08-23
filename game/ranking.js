// Ranking aggregation stays DOM-free so persistence and date edge cases are
// covered without rendering the screen.

export const RANKING_METRICS = [
  { id: "boards", label: "Boards", fullLabel: "Boards completed" },
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

export function roomElapsedSeconds(room) {
  const completedMs = timestampMs(room?.completedAt);
  // Multiplayer rooms can sit on the invite screen long before play. Older
  // clients persisted that waiting as elapsed board time. A shared board is
  // timed from its first match; for races, repair only clearly impossible
  // legacy values so valid pre-first-match race time remains counted.
  if ((room?.mode === "shared" || room?.mode === "race") && completedMs != null) {
    const firstMatchMs = (room?.state?.matchLog || [])
      .map((match) => timestampMs(match?.at))
      .find((at) => at != null);
    if (firstMatchMs != null && completedMs >= firstMatchMs) {
      const eventElapsedMs = completedMs - firstMatchMs;
      const storedElapsedMs = Number(room?.elapsedMs);
      if (room.mode === "shared" || !Number.isFinite(storedElapsedMs) || storedElapsedMs > eventElapsedMs + 10 * 60 * 1000) {
        return Math.max(1, Math.round(eventElapsedMs / 1000));
      }
    }
  }
  const elapsedMs = Number(room?.elapsedMs);
  if (Number.isFinite(elapsedMs) && elapsedMs > 0) {
    return Math.max(1, Math.round(elapsedMs / 1000));
  }
  // A room can sit open for days before anyone starts playing. Treating
  // createdAt as the start time turns that idle period into a bogus board
  // duration, so legacy rooms without an explicit start remain untimed.
  const startedMs = timestampMs(room?.startedAt);
  if (completedMs == null || startedMs == null || completedMs < startedMs) return null;
  return Math.max(1, Math.round((completedMs - startedMs) / 1000));
}

export function aggregateRankings(rooms, period, now = Date.now()) {
  const since = rankingPeriodStartMs(period, now);
  const byPlayer = new Map();
  const ensurePlayer = (name) => {
    if (!byPlayer.has(name)) byPlayer.set(name, { name, boards: 0, timedBoards: 0, pairs: 0, timeS: 0, share: 0 });
    return byPlayer.get(name);
  };
  for (const room of Object.values(rooms || {})) {
    const completedMs = timestampMs(room?.completedAt);
    const completedInPeriod = completedMs != null && completedMs >= since;
    const totalPairs = Number(room.tileCount) / 2;
    const elapsedS = roomElapsedSeconds(room);
    const botNames = new Set(room.botNames || []);
    const players = Array.isArray(room.players) ? room.players : Object.keys(room.pairsCleared || {});

    // Pair credit is event-based so matches on unfinished boards appear
    // immediately. Completed-board metrics stay tied to completedAt.
    const matchLog = Array.isArray(room.state?.matchLog) ? room.state.matchLog : [];
    const loggedPairs = new Map();
    for (const match of matchLog) {
      const name = match?.user;
      const at = timestampMs(match?.at);
      if (!name || botNames.has(name) || at == null || at < since) continue;
      loggedPairs.set(name, (loggedPairs.get(name) || 0) + 1);
    }
    for (const name of players) {
      if (!name || botNames.has(name)) continue;
      const pairs = Number(room.pairsCleared?.[name]) || 0;
      // Historical rooms have no per-match log. Preserve their prior
      // completed-room behavior, and use an active room's start timestamp
      // as the best available boundary when no event history exists.
      const activeMs = timestampMs(room?.startedAt) ?? timestampMs(room?.createdAt);
      const fallbackPairs = matchLog.length === 0 && (completedInPeriod || (completedMs == null && activeMs != null && activeMs >= since)) ? pairs : 0;
      const pairCredit = loggedPairs.get(name) ?? fallbackPairs;
      if (!completedInPeriod && pairCredit === 0) continue;

      const aggregate = ensurePlayer(name);
      aggregate.pairs += pairCredit;
      if (completedInPeriod) {
        aggregate.boards += 1;
        if (elapsedS != null) {
          aggregate.timeS += elapsedS;
          aggregate.timedBoards += 1;
        }
        aggregate.share += totalPairs > 0 ? (pairs / totalPairs) * 100 : 0;
      }
    }
  }
  return [...byPlayer.values()];
}

export function rankingMetricValue(row, metric) {
  if (metric === "boards") return row.boards;
  if (metric === "pairs") return row.pairs;
  if (metric === "speed") return row.timedBoards ? Math.round(row.timeS / row.timedBoards) : 0;
  if (metric === "share") return row.boards ? Math.round(row.share / row.boards) : 0;
  return 0;
}

// Home-card ranking: unlike the full Ranking screen, every registered
// player remains visible even before they record a result in the window.
export function topRegisteredRankings(rooms, users, period, metric, limit = 3, now = Date.now()) {
  const aggregates = new Map(aggregateRankings(rooms, period, now).map((row) => [row.name, row]));
  // Ranking history can know a registered human before this device has
  // received that player's profile, so use both sources for the roster.
  const registeredNames = new Set([...Object.keys(users || {}), ...aggregates.keys()]);
  const rows = [...registeredNames].map((name) => {
    const aggregate = aggregates.get(name) || { name, boards: 0, timedBoards: 0, pairs: 0, timeS: 0, share: 0 };
    return { ...aggregate, value: rankingMetricValue(aggregate, metric) };
  });
  rows.sort((a, b) => {
    if (metric === "speed") {
      const aValue = a.value || Infinity;
      const bValue = b.value || Infinity;
      return aValue - bValue || a.name.localeCompare(b.name);
    }
    return b.value - a.value || a.name.localeCompare(b.name);
  });
  return rows.slice(0, Math.max(0, limit));
}
