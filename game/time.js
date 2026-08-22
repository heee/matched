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
