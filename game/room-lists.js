// Pure room-list selectors shared by the home screen and its expanded list.

import { isActualPlayerName } from "./identity.js";

export function hasStartedRoom(room, currentUser) {
  return room?.startedPlayers?.includes(currentUser)
    || Number(room?.pairsCleared?.[currentUser] || 0) > 0
    || (room?.createdBy === currentUser && roomHasProgress(room));
}

export function roomHasProgress(room) {
  return Object.values(room?.pairsCleared || {}).some((count) => Number(count) > 0)
    || room?.state?.state === "in_progress"
    || room?.state?.state === "completed";
}

export function hasWaitingReason(room, invites = []) {
  if (!room || room.mode === "solo") return false;
  const bots = new Set(room.botNames || []);
  const anotherHumanJoined = (room.players || []).some((name) => name !== room.createdBy && !bots.has(name));
  const pendingInvite = invites.some((invite) => invite.roomId === room.id);
  return room.visibility === "open" || anotherHumanJoined || pendingInvite;
}

export function waitingForPlayersRooms(rooms, currentUser, activeRoomId, invites = []) {
  return rooms.filter((room) =>
    room.id !== activeRoomId
    && room.createdBy === currentUser
    && room.state?.state !== "completed"
    && !roomHasProgress(room)
    && hasWaitingReason(room, invites)
  );
}

export function shouldAbandonRoomOnExit(room, currentUser, invites = []) {
  return room?.createdBy === currentUser
    && room.state?.state !== "completed"
    && !roomHasProgress(room)
    && !hasWaitingReason(room, invites);
}

export function continuePlayingRooms(rooms, currentUser, activeRoomId) {
  return rooms.filter((room) =>
    room.id !== activeRoomId
    && room.players?.includes(currentUser)
    && hasStartedRoom(room, currentUser)
    && roomHasProgress(room)
    && room.state?.state !== "completed"
  );
}

export function refreshableRoomsForUser(rooms, currentUser) {
  return rooms.filter((room) =>
    room?.state?.state !== "completed"
    && (room?.createdBy === currentUser || room?.players?.includes(currentUser))
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
