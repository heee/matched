export function timestampMs(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function elapsedMsSince(startedAt, now = Date.now()) {
  const startMs = timestampMs(startedAt);
  return startMs == null ? null : Math.max(0, now - startMs);
}

// Shared and race rooms can sit in the invite sheet for hours before anybody
// plays. Their board clock begins with the first successful match, not at
// room creation. The match log also repairs legacy rooms that stored
// createdAt as startedAt before this rule was introduced.
export function roomTimerStartMs(room) {
  const stored = timestampMs(room?.startedAt);
  if (room?.mode !== "shared" && room?.mode !== "race") return stored;
  const firstMatch = (room?.state?.matchLog || [])
    .map((entry) => timestampMs(entry?.at))
    .find((value) => value != null);
  return firstMatch ?? null;
}
