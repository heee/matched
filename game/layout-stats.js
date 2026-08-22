export function completedLayoutStats(rooms, user) {
  const byLayout = {};
  for (const room of Object.values(rooms || {})) {
    const players = Array.isArray(room?.players) ? room.players : [];
    if (!room?.completedAt || !room.layoutId || !players.includes(user)) continue;
    const stats = byLayout[room.layoutId] || { boards: 0, pairs: 0 };
    stats.boards += 1;
    stats.pairs += Number(room.pairsCleared?.[user]) || 0;
    byLayout[room.layoutId] = stats;
  }
  return byLayout;
}
