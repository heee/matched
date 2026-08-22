export const MAX_LAYOUT_LEVEL = 100;

// Layout progression launched without retroactive credit. Completed rooms
// before this instant remain available to rankings and other historical stats,
// but do not advance the new per-layout levels.
export const LAYOUT_LEVELS_STARTED_AT = "2026-08-22T18:53:19.162Z";

export function gamesForLayoutLevel(level) {
  const resolved = Math.max(0, Math.min(MAX_LAYOUT_LEVEL, Math.floor(Number(level) || 0)));
  if (resolved === 0) return 0;

  // Integer steps rise smoothly from five games to fifteen. Rounding this
  // symmetric ramp makes the 100 per-level steps total exactly 1,000.
  let total = 0;
  for (let current = 1; current <= resolved; current += 1) {
    total += 5 + Math.round((10 * (current - 1)) / (MAX_LAYOUT_LEVEL - 1));
  }
  return total;
}

export function layoutLevelForGames(completedGames) {
  const games = Math.max(0, Math.floor(Number(completedGames) || 0));
  let low = 0;
  let high = MAX_LAYOUT_LEVEL;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (gamesForLayoutLevel(mid) <= games) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function layoutLevelProgress(completedGames) {
  const games = Math.max(0, Math.floor(Number(completedGames) || 0));
  const level = layoutLevelForGames(games);
  if (level >= MAX_LAYOUT_LEVEL) return { level, progress: 1, remaining: 0 };

  const floor = gamesForLayoutLevel(level);
  const ceiling = gamesForLayoutLevel(level + 1);
  return {
    level,
    progress: Math.max(0, Math.min(1, (games - floor) / (ceiling - floor))),
    remaining: ceiling - games,
  };
}
