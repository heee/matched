// Pure room-list selectors shared by the home screen and its expanded list.

import { isActualPlayerName } from "./identity.js";

export function continuePlayingRooms(rooms, currentUser, activeRoomId) {
  return rooms.filter((room) =>
    room.id !== activeRoomId
    && room.players?.includes(currentUser)
    && room.state?.state !== "completed"
  );
}

export function openRoomsForUser(rooms, users, currentUser) {
  return rooms.filter((room) => {
    const creator = room.createdBy;
    return room.visibility === "open"
      && (room.mode === "shared" || room.mode === "race")
      && room.state?.state !== "completed"
      && !room.players?.includes(currentUser)
      && !!creator
      && isActualPlayerName(creator)
      && creator !== currentUser
      && !!users?.[creator]
      && room.players?.includes(creator)
      && !room.botNames?.includes(creator);
  });
}
