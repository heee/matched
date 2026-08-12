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

export function todayDateStr(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function msUntilNextReset(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime() - now.getTime();
}
