// Display labels must never become stored player identities. Player names
// are still the current persistence key, so keep this validation centralized.

const RESERVED_PLAYER_NAMES = new Set(["you", "anonymous"]);

export function isActualPlayerName(name) {
  return typeof name === "string"
    && name.trim().length > 0
    && !RESERVED_PLAYER_NAMES.has(name.trim().toLowerCase());
}

export function repairCurrentPlayerAliases(room, currentUser) {
  if (!room || !isActualPlayerName(currentUser) || !Array.isArray(room.players)) return false;
  const aliases = room.players.filter((name) =>
    typeof name === "string" && (
      name.trim().toLowerCase() === "you"
      || (name.toLowerCase() === currentUser.toLowerCase() && name !== currentUser)
    )
  );
  if (aliases.length === 0) return false;

  const aliasSet = new Set(aliases);
  room.players = [...new Set(room.players.map((name) => aliasSet.has(name) ? currentUser : name))];
  if (aliasSet.has(room.createdBy)) room.createdBy = currentUser;
  if (Array.isArray(room.botNames)) room.botNames = room.botNames.filter((name) => !aliasSet.has(name));

  for (const key of ["pairsCleared", "streaks", "assistsUsed"]) {
    room[key] = room[key] || {};
    for (const alias of aliases) {
      room[key][currentUser] = Math.max(room[key][currentUser] || 0, room[key][alias] || 0);
      delete room[key][alias];
    }
  }

  for (const entry of room.state?.tray || []) if (aliasSet.has(entry.user)) entry.user = currentUser;
  for (const entry of room.state?.matchLog || []) if (aliasSet.has(entry.user)) entry.user = currentUser;
  if (room.racers) {
    for (const alias of aliases) {
      if (!room.racers[currentUser] && room.racers[alias]) room.racers[currentUser] = room.racers[alias];
      delete room.racers[alias];
    }
  }
  return true;
}
