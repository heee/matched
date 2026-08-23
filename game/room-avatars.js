// Player badges shown on Continue playing cards. Keep this separate from the
// DOM renderer so the solo/multiplayer fallbacks stay explicit and testable.
export function continueAvatarEntries(room, currentUser) {
  const players = [];
  const seen = new Set();
  for (const [seat, name] of (room?.players || []).entries()) {
    if (typeof name !== "string" || !name.trim() || seen.has(name)) continue;
    seen.add(name);
    players.push({ name, seat });
  }

  if (room?.mode === "solo") {
    const creator = room.createdBy || players[0]?.name || currentUser || "?";
    const creatorEntry = players.find((entry) => entry.name === creator);
    return [creatorEntry || { name: creator, seat: 0 }];
  }

  const entries = players.length
    ? players
    : [{ name: room?.createdBy || currentUser || "?", seat: 0 }];
  if (entries.length === 1) entries.push({ name: "?", seat: 1, open: true });
  return entries;
}
