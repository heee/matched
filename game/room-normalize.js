import { buildFaceSet, INK } from "./tiles.js";

const FACE_BY_ID = new Map(buildFaceSet().map((face) => [face.id, face]));

export function normalizeFace(face) {
  const id = typeof face === "string" ? face : face?.id;
  const canonical = FACE_BY_ID.get(id);
  if (canonical) return { ...canonical };
  if (face?.kind) return face;
  // Unknown historical data should be conspicuous, never silently blank.
  return { id: id || "unknown", kind: "char", top: "?", bot: "", color: INK };
}

function normalizeTiles(tiles) {
  return Array.isArray(tiles) ? tiles.map((tile) => ({ ...tile, face: normalizeFace(tile.face) })) : [];
}

export function normalizeRoomData(room) {
  if (!room || typeof room !== "object") return room;
  const state = room.state && typeof room.state === "object" ? room.state : {};
  const normalized = {
    ...room,
    state: {
      ...state,
      tiles: normalizeTiles(state.tiles),
      tray: Array.isArray(state.tray)
        ? state.tray.map((entry) => ({ ...entry, face: normalizeFace(entry.face) }))
        : [],
      matchLog: Array.isArray(state.matchLog) ? state.matchLog : [],
    },
  };
  if (room.racers && typeof room.racers === "object") {
    normalized.racers = Object.fromEntries(Object.entries(room.racers).map(([name, racer]) => [
      name,
      { ...racer, tiles: normalizeTiles(racer?.tiles) },
    ]));
  }
  return normalized;
}
