// Matched — deterministic daily-board selection. Pure function of the date
// string, so every device picks the same layout/seed without needing the
// Worker (which does the same thing server-side in worker/index.js).

import { hashSeed } from "./mahjong.js";
import { LAYOUTS } from "./layouts.js";

const DAILY_LAYOUT_IDS = Object.keys(LAYOUTS).filter((id) => !LAYOUTS[id].tabletOnly);

export function dailyLayoutFor(dateStr) {
  const idx = hashSeed(dateStr) % DAILY_LAYOUT_IDS.length;
  return DAILY_LAYOUT_IDS[idx];
}

export function dailySeedFor(dateStr) {
  return hashSeed(`daily-${dateStr}`);
}

// Local calendar date, not UTC — the puzzle resets shortly after midnight
// wherever the player is, not at a fixed UTC instant (which landed at 6-7pm
// for US timezones and confused everyone waiting on a "daily" reset).
function pad2(n) {
  return String(n).padStart(2, "0");
}

export function todayDateStr(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function msUntilNextReset(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
