// Pure room-list selectors shared by the home screen and its expanded list.

import { isActualPlayerName } from "./identity.js";

export function hasStartedRoom(room, currentUser) {
  return room?.createdBy === currentUser
    || room?.startedPlayers?.includes(currentUser)
    || Number(room?.pairsCleared?.[currentUser] || 0) > 0;
}

export function continuePlayingRooms(rooms, currentUser) {
  return rooms.filter((room) =>
    room.players?.includes(currentUser)
    && hasStartedRoom(room, currentUser)
    && room.state?.state !== "completed"
  );
}

export function openRoomsForUser(rooms, users, currentUser) {
  return rooms.filter((room) => {
    const creator = room.createdBy;
    return room.visibility === "open"
      && (room.mode === "shared" || room.mode === "race")
      && room.state?.state !== "completed"
      && (!room.players?.includes(currentUser) || !hasStartedRoom(room, currentUser))
      && !!creator
      && isActualPlayerName(creator)
      && creator !== currentUser
      && !!users?.[creator]
      && room.players?.includes(creator)
      && !room.botNames?.includes(creator);
  });
}

export function randomRoomSample(rooms, limit = 3, random = Math.random) {
  const shuffled = [...rooms];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, limit);
}
