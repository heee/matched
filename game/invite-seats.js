export function inviteSeatEntries(room, currentUser, invitedNames = [], limit = 3) {
  const players = Array.isArray(room?.players) ? room.players : [];
  const bots = new Set(room?.botNames || []);
  const seen = new Set([currentUser]);
  const entries = [];

  for (const name of players) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    entries.push({
      name,
      kind: bots.has(name) ? "bot" : "joined",
      difficulty: bots.has(name) ? (room?.botDifficulty?.[name] || "medium") : null,
    });
  }

  for (const name of invitedNames) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    entries.push({ name, kind: "invited", difficulty: null });
  }

  return entries.slice(0, limit);
}
