// Matched — app orchestration only. Screens and game logic live in
// screens/ and game/; this file wires navigation, the bottom tab bar, and
// the local-first store, then hands each screen its render call.

import { createWorkerApi } from "./api.js?v=42";
import { createJsonStorage, normalizeSharedData, mergeSharedData, LOCAL_KEYS, DEFAULT_SETTINGS } from "./storage.js?v=43";
import { createMutationQueue } from "./sync.js?v=41";
import { el, TAB_DEFS } from "./screens/shared-ui.js?v=41";
import { isActualPlayerName, repairCurrentPlayerAliases } from "./game/identity.js?v=38";
import { equippedFeltName, feltCssVars } from "./game/felts.js?v=39";
import { roomHasProgress, shouldAbandonRoomOnExit } from "./game/room-lists.js?v=2";

import { renderNameEntry } from "./screens/name-entry.js?v=41";
import { renderHome } from "./screens/home.js?v=54";
import { renderPlayCatalog } from "./screens/play-catalog.js?v=41";
import { renderRoomSetup } from "./screens/room-setup.js?v=43";
import { renderRanking } from "./screens/ranking.js?v=43";
import { renderHeadToHead } from "./screens/head-to-head.js?v=1";
import { renderProfile } from "./screens/profile.js?v=44";
import { renderManagePlayers } from "./screens/manage-players.js?v=38";
import { renderBoard } from "./screens/board.js?v=54";
import { renderRaceBoard } from "./screens/race-board.js?v=46";
import { renderResults } from "./screens/results.js?v=40";
import { renderInvite } from "./screens/invite.js?v=42";
import { renderDaily } from "./screens/daily.js?v=42";
import { renderContinuePlaying } from "./screens/continue-playing.js?v=40";
import { renderOpenRooms } from "./screens/open-rooms.js?v=45";

const jsonStorage = createJsonStorage(localStorage);
const workerApi = createWorkerApi({ baseUrl: window.WORKER_URL || "", appKey: window.APP_KEY || "" });
const mutationQueue = createMutationQueue({ jsonStorage, key: LOCAL_KEYS.pendingQueue });

const savedCurrentUser = (() => {
  const saved = jsonStorage.read(LOCAL_KEYS.currentUser, "");
  return isActualPlayerName(saved) ? saved : "";
})();
const savedActiveRoomIds = jsonStorage.read(LOCAL_KEYS.activeRooms, {});
const activeRoomIds = savedActiveRoomIds && typeof savedActiveRoomIds === "object" ? savedActiveRoomIds : {};
const legacyActiveRoomId = jsonStorage.read(LOCAL_KEYS.activeRoom, null);
if (savedCurrentUser && legacyActiveRoomId && !activeRoomIds[savedCurrentUser]) {
  activeRoomIds[savedCurrentUser] = legacyActiveRoomId;
}
const savedDailyCompletedByUser = jsonStorage.read(LOCAL_KEYS.dailyCompletedByUser, {});
const dailyCompletedByUser = savedDailyCompletedByUser && typeof savedDailyCompletedByUser === "object" ? savedDailyCompletedByUser : {};
const legacyLastDailyCompleted = jsonStorage.read(LOCAL_KEYS.lastDailyCompleted, null);
if (savedCurrentUser && legacyLastDailyCompleted && !dailyCompletedByUser[savedCurrentUser]) {
  dailyCompletedByUser[savedCurrentUser] = legacyLastDailyCompleted;
}
const savedDailyStreaks = jsonStorage.read(LOCAL_KEYS.dailyStreaks, {});
const dailyStreaks = savedDailyStreaks && typeof savedDailyStreaks === "object" ? savedDailyStreaks : {};
const legacyDailyStreak = jsonStorage.read(LOCAL_KEYS.dailyStreak, 0);
if (savedCurrentUser && legacyDailyStreak && !dailyStreaks[savedCurrentUser]) dailyStreaks[savedCurrentUser] = legacyDailyStreak;

function loadStore() {
  const raw = jsonStorage.read(LOCAL_KEYS.cacheData, {});
  return normalizeSharedData(raw);
}
function saveStore(store) {
  jsonStorage.write(LOCAL_KEYS.cacheData, store);
}

const state = {
  currentUser: savedCurrentUser,
  settings: { ...DEFAULT_SETTINGS, ...jsonStorage.read(LOCAL_KEYS.settings, {}) },
  points: jsonStorage.read(LOCAL_KEYS.points, 0),
  equipped: jsonStorage.read(LOCAL_KEYS.equipped, {}),
  dailyStreaks,
  dailyCompletedByUser,
  dailyResults: jsonStorage.read(LOCAL_KEYS.dailyResults, {}),
  activeRoomId: activeRoomIds[savedCurrentUser] || null,
  activeRoomIds,
  store: loadStore(),
  screen: "home",
  screenParams: {},
  lastResult: null,
};

function persist() {
  if (isActualPlayerName(state.currentUser)) {
    if (state.activeRoomId) state.activeRoomIds[state.currentUser] = state.activeRoomId;
    else delete state.activeRoomIds[state.currentUser];
  }
  jsonStorage.write(LOCAL_KEYS.currentUser, state.currentUser);
  jsonStorage.write(LOCAL_KEYS.settings, state.settings);
  jsonStorage.write(LOCAL_KEYS.points, state.points);
  jsonStorage.write(LOCAL_KEYS.equipped, state.equipped);
  jsonStorage.write(LOCAL_KEYS.dailyStreaks, state.dailyStreaks);
  jsonStorage.write(LOCAL_KEYS.dailyStreak, state.dailyStreaks[state.currentUser] || 0);
  jsonStorage.write(LOCAL_KEYS.dailyCompletedByUser, state.dailyCompletedByUser);
  jsonStorage.write(LOCAL_KEYS.lastDailyCompleted, state.dailyCompletedByUser[state.currentUser] || null);
  jsonStorage.write(LOCAL_KEYS.dailyResults, state.dailyResults);
  jsonStorage.write(LOCAL_KEYS.activeRoom, state.activeRoomId);
  jsonStorage.write(LOCAL_KEYS.activeRooms, state.activeRoomIds);
  saveStore(state.store);
}

function announce(message) {
  const node = document.getElementById("a11y-announcer");
  if (!node) return;
  node.textContent = "";
  requestAnimationFrame(() => { node.textContent = message; });
}

function toast(message) {
  announce(message);
}

const SCREENS = {
  "name-entry": renderNameEntry,
  home: renderHome,
  "play-catalog": renderPlayCatalog,
  "room-setup": renderRoomSetup,
  ranking: renderRanking,
  "head-to-head": renderHeadToHead,
  profile: renderProfile,
  "manage-players": renderManagePlayers,
  board: renderBoard,
  "race-board": renderRaceBoard,
  results: renderResults,
  invite: renderInvite,
  daily: renderDaily,
  "continue-playing": renderContinuePlaying,
  "open-rooms": renderOpenRooms,
};

// Screens not directly reachable from a tab keep whichever tab was active
// (matches Boys Bonanza's TAB_FOR_SCREEN convention).
const TAB_FOR_SCREEN = {
  "name-entry": "home",
  home: "home",
  "play-catalog": "play-catalog",
  "room-setup": "room-setup",
  ranking: "ranking",
  "head-to-head": "ranking",
  profile: "profile",
  "manage-players": "profile",
  board: "home",
  "race-board": "home",
  results: "home",
  invite: "home",
  daily: "home",
  "continue-playing": "home",
  "open-rooms": "home",
};

const ctx = {
  state,
  api: workerApi,
  mutationQueue,
  persist,
  toast,
  announce,
  navigate,
  selectUser,
  reportRoomProgress,
  commitRoomMembership,
  reportCompletedRoom,
  reportDailyResult,
  abandonRoom,
  refreshAppearance,
  refreshUsers,
  refreshRoom,
};

async function refreshUsers() {
  if (!workerApi.configured()) return state.store.users;
  const data = await workerApi.fetchUsers();
  state.store.users = { ...state.store.users, ...(data.users || {}) };
  persist();
  return state.store.users;
}

async function refreshRoom(roomId) {
  if (!workerApi.configured()) return state.store.rooms[roomId] || null;
  let data;
  try {
    data = await workerApi.fetchRoom(roomId);
  } catch {
    // Older Worker deployments do not have the focused room route yet.
    // Fall back to the existing all-room read so invite membership still
    // refreshes during a staggered frontend/Worker release.
    const shared = await workerApi.fetchData();
    data = { room: shared.rooms?.[roomId] || null };
  }
  const normalized = normalizeSharedData({ rooms: data.room ? { [roomId]: data.room } : {} });
  const room = normalized.rooms[roomId] || null;
  if (room) {
    state.store.rooms[roomId] = room;
    persist();
  }
  return room;
}

function abandonRoom(room) {
  if (!room) return;
  delete state.store.rooms[room.id];
  state.store.invites = (state.store.invites || []).filter((invite) => invite.roomId !== room.id);
  if (state.activeRoomId === room.id) state.activeRoomId = null;
  persist();
  if (!workerApi.configured()) return;
  workerApi.deleteRoom(room.id)
    .catch(() => mutationQueue.enqueue("delete-room", { roomId: room.id }, { id: `delete-room:${room.id}` }));
}

function commitRoomMembership(room) {
  const user = state.currentUser;
  if (!room.players.includes(user)) room.players.push(user);
  room.startedPlayers = room.startedPlayers || [];
  if (!room.startedPlayers.includes(user)) room.startedPlayers.push(user);
  state.activeRoomId = room.id;
  persist();
  if (!workerApi.configured()) return;
  workerApi.joinRoom(room.id, user)
    .catch(() => mutationQueue.enqueue("join-room", { roomId: room.id, user }));
}

function roomProgressPayload(room) {
  return {
    startedAt: room.startedAt,
    state: room.state,
    players: room.players,
    startedPlayers: room.startedPlayers || [],
    botNames: room.botNames || [],
    pairsCleared: room.pairsCleared,
    streaks: room.streaks,
    peakStreaks: room.peakStreaks || {},
    assistsUsed: room.assistsUsed || {},
    racers: room.racers,
  };
}

function reportRoomProgress(room) {
  persist();
  if (!workerApi.configured()) return;
  const mutation = { roomId: room.id, payload: roomProgressPayload(room) };
  workerApi.updateRoom(mutation).catch(() => {
    mutationQueue.enqueue("update-room", mutation, { id: `update-room:${room.id}` });
  });
}

function completedRoomPayload(room) {
  return {
    completedAt: room.completedAt,
    startedAt: room.startedAt,
    elapsedMs: room.elapsedMs,
    state: room.state,
    players: room.players,
    startedPlayers: room.startedPlayers || [],
    botNames: room.botNames || [],
    botDifficulty: room.botDifficulty || {},
    pairsCleared: room.pairsCleared,
    streaks: room.streaks,
    peakStreaks: room.peakStreaks || {},
    assistsUsed: room.assistsUsed || {},
    comboBonus: room.comboBonus || {},
    racers: room.racers,
  };
}

function reportCompletedRoom(room) {
  persist();
  if (!workerApi.configured()) return;
  const mutation = { roomId: room.id, payload: completedRoomPayload(room) };
  workerApi.completeRoom(mutation).catch(() => {
    mutationQueue.enqueue("complete-room", mutation, { id: `complete-room:${room.id}` });
  });
}

function reportDailyResult(room, elapsedMs) {
  const payload = {
    date: room.dailyDate || new Date().toISOString().slice(0, 10),
    user: state.currentUser,
    elapsedMs,
    pairsMatched: Number(room.pairsCleared?.[state.currentUser]) || 0,
  };
  state.dailyResults[`${payload.date}:${payload.user}`] = payload;
  persist();
  if (!workerApi.configured()) return;
  workerApi.registerUser(payload.user).then(() => workerApi.reportDailyResult(payload)).catch(() => {
    mutationQueue.enqueue("register-user", { user: payload.user }, { id: `register-user:${payload.user}` });
    mutationQueue.enqueue("daily-result", payload, { id: `daily-result:${payload.date}:${payload.user}` });
  });
}

async function flushPendingMutations() {
  if (!workerApi.configured()) return;
  await mutationQueue.flush(({ type, payload }) => {
    if (type === "join-room") return workerApi.joinRoom(payload.roomId, payload.user);
    if (type === "update-room") return workerApi.updateRoom(payload);
    if (type === "create-room") return workerApi.createRoom(payload);
    if (type === "complete-room") return workerApi.completeRoom(payload);
    if (type === "register-user") return workerApi.registerUser(payload.user);
    if (type === "daily-result") return workerApi.reportDailyResult(payload);
    if (type === "delete-room") return workerApi.deleteRoom(payload.roomId);
    throw new Error(`Unsupported queued mutation: ${type}`);
  });
}

function navigate(screenId, params = {}) {
  if (!SCREENS[screenId]) throw new Error(`Unknown screen: ${screenId}`);
  const roomScreen = ["invite", "board", "race-board"].includes(state.screen);
  const leavingRoomId = roomScreen ? state.screenParams.roomId : null;
  const stayingInSameRoom = ["invite", "board", "race-board"].includes(screenId) && params.roomId === leavingRoomId;
  if (leavingRoomId && !stayingInSameRoom) {
    const room = state.store.rooms[leavingRoomId];
    const invites = state.store.invites || [];
    if (shouldAbandonRoomOnExit(room, state.currentUser, invites)) {
      abandonRoom(room);
    } else if (room && !roomHasProgress(room) && state.activeRoomId === room.id) {
      state.activeRoomId = null;
      persist();
    }
  }
  // Screens that run timers (board, race-board) register a cleanup hook
  // here since a navigation just replaces the DOM wholesale rather than
  // unmounting through any lifecycle callback.
  if (typeof window.__matchedCleanup === "function") {
    window.__matchedCleanup();
    window.__matchedCleanup = null;
  }
  state.screen = screenId;
  state.screenParams = params;
  render();
}

function renderTabBar() {
  const bar = document.getElementById("tab-bar");
  bar.innerHTML = "";
  bar.style.display = state.screen === "name-entry" ? "none" : "";
  if (state.screen === "name-entry") return;
  const active = TAB_FOR_SCREEN[state.screen] || "home";
  for (const tab of TAB_DEFS) {
    const isActive = tab.id === active;
    const item = el("button", {
      class: `tab-item${isActive ? " active" : ""}`,
      type: "button",
      "aria-current": isActive ? "page" : undefined,
      onClick: () => navigate(tab.id),
    });
    if (tab.id === "room-setup") {
      item.appendChild(el("div", { class: "tab-plus", text: "+" }));
    } else if (tab.id === "ranking") {
      const bars = el("div", { class: "rank-bars" });
      bars.appendChild(el("span", { style: "height:8px" }));
      bars.appendChild(el("span", { style: "height:13px" }));
      bars.appendChild(el("span", { style: "height:18px" }));
      item.appendChild(bars);
    } else {
      item.appendChild(el("div", { class: "tab-icon", text: tab.icon }));
    }
    if (tab.label) item.appendChild(el("div", { class: "tab-label", text: tab.label }));
    else item.appendChild(el("div", { class: "tab-label", text: " " }));
    bar.appendChild(item);
  }
}

function pendingRoomIdFromHash() {
  const m = location.hash.match(/^#\/r\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function joinRoomFromInvite(roomId) {
  if (workerApi.configured()) {
    try {
      const data = await workerApi.fetchData();
      state.store = normalizeSharedData({ ...state.store, ...data });
      saveStore(state.store);
    } catch {
      // fall through to whatever's already cached locally
    }
  }
  const room = state.store.rooms[roomId];
  if (!room) {
    toast("That invite link looks invalid or the room was deleted.");
    navigate("home");
    return;
  }
  repairCurrentPlayerAliases(room, state.currentUser);
  if (!room.players.includes(state.currentUser)) {
    room.players.push(state.currentUser);
    room.pairsCleared[state.currentUser] = room.pairsCleared[state.currentUser] || 0;
    room.streaks[state.currentUser] = room.streaks[state.currentUser] || 0;
    state.store.rooms[roomId] = room;
    persist();
  }
  navigate(room.mode === "race" ? "race-board" : "board", { roomId });
}

async function afterLogin() {
  const roomId = pendingRoomIdFromHash();
  if (roomId) {
    history.replaceState(null, "", location.pathname + location.search);
    await joinRoomFromInvite(roomId);
    return;
  }
  navigate("home");
}

// Mirrors the Worker's registerUser() hue rotation (worker/index.js
// PLAYER_HUES) so a locally-created profile gets the same stable color a
// server round-trip would have assigned it.
const PLAYER_HUES = [42, 155, 20, 213, 280, 190, 340, 95];

function selectUser(name) {
  if (!isActualPlayerName(name)) {
    toast("Choose your actual name — ‘You’ is only used as a label.");
    return;
  }
  if (isActualPlayerName(state.currentUser)) {
    if (state.activeRoomId) state.activeRoomIds[state.currentUser] = state.activeRoomId;
    else delete state.activeRoomIds[state.currentUser];
  }
  state.currentUser = name;
  state.activeRoomId = state.activeRoomIds[name] || null;
  // Write the profile locally right away — previously this only happened
  // via workerApi.registerUser()'s server round-trip, so switching to (or
  // creating) a player while offline, or before that fetch resolved, left
  // state.store.users empty and the profile picker showed no saved cards.
  if (!state.store.users[name]) {
    const count = Object.keys(state.store.users).length;
    state.store.users[name] = {
      hue: PLAYER_HUES[count % PLAYER_HUES.length],
      createdAt: new Date().toISOString(),
      settings: { ...DEFAULT_SETTINGS },
    };
  }
  persist();
  if (workerApi.configured()) workerApi.registerUser(name).catch(() => {});
  afterLogin();
}

function refreshAppearance() {
  const app = document.getElementById("app");
  app.style.cssText = state.settings.feltAcrossApp
    ? feltCssVars(equippedFeltName(state.points, state.equipped))
    : "";
}

function render() {
  refreshAppearance();
  const root = document.getElementById("screen-root");
  root.innerHTML = "";
  const screenEl = el("div", { class: "screen active", id: `screen-${state.screen}` });
  root.appendChild(screenEl);
  renderTabBar();
  SCREENS[state.screen](screenEl, ctx, state.screenParams);
}

// Hydrate the users/rooms cache in the background (best-effort — the app
// still works offline off whatever's already in localStorage).
if (workerApi.configured()) {
  flushPendingMutations().catch(() => {});
  window.addEventListener("online", () => flushPendingMutations().catch(() => {}));
  workerApi.fetchData().then((data) => {
    state.store = mergeSharedData(state.store, data);
    saveStore(state.store);
    // The name-entry picker builds its list synchronously from state.store,
    // so if this resolves after it's already on screen, re-render to show
    // the profiles that just came in.
    if (state.screen === "name-entry") render();
  }).catch(() => {});
}

if (state.currentUser) {
  if (workerApi.configured()) workerApi.registerUser(state.currentUser).catch(() => {});
  afterLogin();
} else {
  navigate("name-entry");
}
