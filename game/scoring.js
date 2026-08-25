// Matched — scoring, tiers, and progression math.
// Pure functions, no DOM/storage.
//
// Ten-tier tile-material ladder, easy to difficult (cheap/common material
// to rare/luxurious), each also naming itself as the tier (tier.name ===
// tier.material — there's no separate tier-name concept anymore, unlike
// the old 4-tier Bone/Jade/Rosewood/Dragon scheme where "Dragon" named the
// tier but "Lacquer" was the material it unlocked).
//
// Threshold curve: roughly doubling early on (fast first few unlocks so
// progression feels alive quickly), stretching out toward the top so the
// last couple of tiers are a real long-term goal rather than a formality.
export const TIERS = [
  { name: "Wood", threshold: 0, material: "Wood" },
  { name: "Stone", threshold: 600, material: "Stone" },
  { name: "Resin", threshold: 1500, material: "Resin" },
  { name: "Bamboo", threshold: 3000, material: "Bamboo" },
  { name: "Bone", threshold: 5500, material: "Bone" },
  { name: "Porcelain", threshold: 9000, material: "Porcelain" },
  { name: "Rosewood", threshold: 14000, material: "Rosewood" },
  { name: "Jade", threshold: 21000, material: "Jade" },
  { name: "Cloisonné", threshold: 30000, material: "Cloisonné" },
  { name: "Lacquer", threshold: 42000, material: "Lacquer" },
];

// Table (felt) and tile (material) cosmetics used to unlock together at
// each tier's threshold. Split apart so they alternate instead — felt
// unlocks right at the tier's own threshold (tier.threshold, i.e. the
// moment you *reach* that tier/rank), and the matching tile material
// unlocks partway to the *next* tier. Net effect: table, then tiles,
// then the next table, etc., roughly twice as many unlock moments along
// the same overall ladder instead of two things landing on the same
// score. The last tier has no "next" to interpolate toward, so its
// material lands a fixed step past its felt instead.
const LAST_TIER_MATERIAL_GAP = 6000;
function materialThresholdForIndex(i) {
  const cur = TIERS[i].threshold;
  const next = TIERS[i + 1] ? TIERS[i + 1].threshold : cur + LAST_TIER_MATERIAL_GAP;
  return Math.round(cur + (next - cur) * 0.5);
}

// Each tier unlocks a named batch, not a single item — per spec, cosmetic
// only (tile materials, felts, layouts, tile face styles). Only Rosewood
// and Lacquer still carry a layout unlock (Nine Gates / Long Table),
// matching what those two layouts already declare as their own `tier` in
// game/layouts.js.
const FELT_NAMES = {
  Wood: "Felt green (default)",
  Stone: "Slate felt",
  Resin: "Mint felt",
  Bamboo: "Bamboo-green felt",
  Bone: "Deep felt",
  Porcelain: "Cobalt felt",
  Rosewood: "Wood-rail table",
  Jade: "Jade felt",
  Cloisonné: "Sapphire felt",
  Lacquer: "Lacquer black",
};
const LAYOUT_UNLOCKS = { Rosewood: "Nine Gates", Lacquer: "Long Table" };

export const TIER_UNLOCKS = Object.fromEntries(TIERS.map((tier, i) => [
  tier.name,
  {
    felt: FELT_NAMES[tier.name],
    feltThreshold: tier.threshold,
    materialThreshold: materialThresholdForIndex(i),
    layout: LAYOUT_UNLOCKS[tier.name] || null,
  },
]));

export function tierForPoints(points) {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (points >= tier.threshold) current = tier;
  }
  return current;
}

export function nextTier(points) {
  return TIERS.find((tier) => tier.threshold > points) || null;
}

export function pointsToNextTier(points) {
  const next = nextTier(points);
  return next ? Math.max(0, next.threshold - points) : 0;
}

// Account levels are a finer-grained, unbounded progression track than the
// ten cosmetic tiers above. Players begin at Level 0; Level 1 costs 1,800
// points (about 5-10 games). Each following level costs a little more, rising
// from 1,800 to 4,500 points by Level 100 on a mildly convex curve. The same
// curve continues beyond 100 without a cap.
const LEVEL_FIRST_COST = 1800;
const LEVEL_100_COST = 4500;
const LEVEL_RAMP_SPAN = 99;
const LEVEL_COST_EXPONENT = 1.15;

function costForLevel(level) {
  const targetLevel = Math.max(1, Math.floor(Number(level) || 1));
  const progress = (targetLevel - 1) / LEVEL_RAMP_SPAN;
  return Math.round(
    LEVEL_FIRST_COST + (LEVEL_100_COST - LEVEL_FIRST_COST) * Math.pow(progress, LEVEL_COST_EXPONENT)
  );
}

export function pointsForLevel(level) {
  const targetLevel = Math.max(0, Math.floor(Number(level) || 0));
  let total = 0;
  for (let current = 1; current <= targetLevel; current += 1) {
    total += costForLevel(current);
  }
  return total;
}

export function levelForPoints(points) {
  const safePoints = Math.max(0, Number(points) || 0);
  let level = 0;
  let total = 0;
  while (total + costForLevel(level + 1) <= safePoints) {
    level += 1;
    total += costForLevel(level);
  }
  return level;
}

export function levelProgress(points) {
  const safePoints = Math.max(0, Number(points) || 0);
  const level = levelForPoints(safePoints);
  const levelStart = pointsForLevel(level);
  const nextLevelAt = pointsForLevel(level + 1);
  return {
    level,
    nextLevel: level + 1,
    nextLevelAt,
    pointsToNext: Math.max(0, nextLevelAt - safePoints),
    progressPct: Math.max(0, Math.min(100, ((safePoints - levelStart) / (nextLevelAt - levelStart)) * 100)),
  };
}

// Every felt-unlock and material-unlock event across all ten tiers,
// chronologically — what the tier bar's "Next unlock" card and any other
// "what's coming up" UI should walk, since felt and material no longer
// share a threshold within a tier.
export function cosmeticUnlockEvents() {
  const events = [];
  for (const tier of TIERS) {
    const u = TIER_UNLOCKS[tier.name];
    events.push({ kind: "felt", tierName: tier.name, label: u.felt, threshold: u.feltThreshold });
    events.push({ kind: "material", tierName: tier.name, label: tier.material, threshold: u.materialThreshold });
  }
  events.sort((a, b) => a.threshold - b.threshold);
  return events;
}

export function nextCosmeticUnlock(points) {
  return cosmeticUnlockEvents().find((e) => e.threshold > points) || null;
}

// Base points per pair, scaled down by assist usage (hint/shuffle/undo all
// count). Speed multiplier rewards a faster clear. Solo play uses the same
// formula, per spec ("Solo play reports into the same metrics").
const BASE_POINTS_PER_PAIR = 10;
export const ASSIST_PENALTY_PER_USE = 0.12; // -12% credit per assist use, floor below
const ASSIST_PENALTY_FLOOR = 0.5; // never below half credit

export function assistMultiplier(assistsUsed) {
  return Math.max(ASSIST_PENALTY_FLOOR, 1 - assistsUsed * ASSIST_PENALTY_PER_USE);
}

export function speedMultiplier(elapsedMs, tileCount) {
  // ~2.5s/tile is "par"; faster than par scales up gently, slower scales
  // down gently, clamped to a sane band so a single wild session can't
  // dominate the leaderboard.
  const parMs = tileCount * 2500;
  if (elapsedMs <= 0 || tileCount <= 0) return 1;
  const ratio = parMs / elapsedMs;
  return Math.max(0.6, Math.min(1.5, ratio));
}

export function pointsForSession({ pairsCleared, assistsUsed = 0, elapsedMs = 0, tileCount = 0 }) {
  const base = pairsCleared * BASE_POINTS_PER_PAIR;
  const withSpeed = base * speedMultiplier(elapsedMs, tileCount);
  const withAssists = withSpeed * assistMultiplier(assistsUsed);
  return Math.round(withAssists);
}

// A "combo" is two of your own clears landing within this window of each
// other — flat bonus per qualifying hit (not the first clear in a chain,
// since there's nothing before it to be quick relative to), added on top
// of pointsForSession's result rather than folded into that formula.
export const COMBO_WINDOW_MS = 4000;
export const COMBO_BONUS_POINTS = 8;

export function boardCompletionShare(playerPairs, totalPairsCleared) {
  if (totalPairsCleared <= 0) return 0;
  return Math.round((playerPairs / totalPairsCleared) * 100);
}

// Player identity colors — gold for "you", then the fixed rotation, then an
// OKLCH hue rotation for any additional player beyond the four named ones.
export const PLAYER_COLORS = ["#d9a441", "#5fbf9b", "#e08a6a", "#7aa8e0"];

// Bots are opt-in seats in Shared/Race rooms (see room-setup's Players
// picker) — session-only opponents, never registered users, never ranked.
export const BOT_DIFFICULTIES = ["easy", "medium", "hard"];
export const BOT_NAME_POOL = ["Dana", "Mika", "Jules", "Robin", "Sasha", "Priya", "Theo", "Nadia"];
// Per-tick odds a bot at this difficulty is the one who claims a free pair,
// consumed by board.js/race-board.js's simulated-opponent timers.
export const BOT_ACT_CHANCE = { easy: 0.3, medium: 0.55, hard: 0.85 };

export function colorForSeat(seatIndex) {
  if (seatIndex < PLAYER_COLORS.length) return PLAYER_COLORS[seatIndex];
  // Rotate hue in OKLCH at the same chroma/lightness as the fourth color
  // (#7aa8e0), spaced evenly for however many extra seats are needed.
  const hueStep = 47; // degrees; avoids repeating the first four hues up to 8 players
  const hue = (210 + (seatIndex - PLAYER_COLORS.length + 1) * hueStep) % 360;
  return `oklch(74% 0.1 ${hue})`;
}

// Stable per-player hue rotation, assigned at registration (see
// selectUser() in app.js and registerUser() in worker/index.js) and
// user-selectable from Profile > Settings. This is the palette offered in
// that picker, rendered as oklch(58% .1 hue) to match the swatch/avatar
// format already used for saved profile cards (name-entry.js).
export const PLAYER_HUES = [42, 155, 20, 213, 280, 190, 340, 95];

export function hueColor(hue) {
  return `oklch(58% .1 ${hue})`;
}

// Player color resolution, identity-first: a player's own chosen/assigned
// hue (game/scoring.js's PLAYER_HUES, stored per-user) wins over the
// seat-position rotation, so a given player reads the same color in every
// room and every other player sees it the same way. Falls back to
// colorForSeat for anyone with no stored hue yet (bots, unregistered
// remote seats before their user record has synced).
export function colorForPlayer(name, seatIndex, users) {
  const hue = users?.[name]?.hue;
  return Number.isFinite(hue) ? hueColor(hue) : colorForSeat(seatIndex);
}

// "Worth mentioning" highlight lines for the Results screen, generated from
// a simple match log rather than hand-written per game. Written
// competitively per spec ("not soft MVP callouts").
//
// assistsUsed is a name -> count map (room.assistsUsed) rather than
// something derived from matchLog: per-clear "was this assisted" tracking
// was never actually recorded on log entries, so counting from the log
// silently always read as zero. The running per-player count the game
// already keeps is the real source of truth.
export function highlightsFromLog(matchLog, players, assistsUsed = {}) {
  const lines = [];
  if (!matchLog.length) return lines;

  // Longest streak in the log.
  let bestStreak = { seat: null, length: 0 };
  const streaks = {};
  for (const entry of matchLog) {
    streaks[entry.seat] = (streaks[entry.seat] || 0) + 1;
    for (const seat of Object.keys(streaks)) if (seat !== String(entry.seat)) streaks[seat] = 0;
    if (streaks[entry.seat] > bestStreak.length) bestStreak = { seat: entry.seat, length: streaks[entry.seat] };
  }
  if (bestStreak.length >= 3) {
    const name = players[bestStreak.seat]?.name || "Someone";
    lines.push(`${name} ran a ${bestStreak.length}-pair streak.`);
  }

  const last = matchLog[matchLog.length - 1];
  if (last) {
    const name = players[last.seat]?.name || "Someone";
    lines.push(`${name} cleared the final pair.`);
  }

  const assistEntries = Object.entries(assistsUsed).filter(([, n]) => n > 0);
  if (assistEntries.length === 0) {
    lines.push("Nobody used an assist this round.");
  } else {
    const bits = assistEntries.map(([name, n]) => {
      const pct = Math.round((1 - assistMultiplier(n)) * 100);
      return `${name} -${pct}% (${n} assist${n === 1 ? "" : "s"})`;
    });
    lines.push(`Assist penalty: ${bits.join(", ")}.`);
  }

  return lines.slice(0, 3);
}
