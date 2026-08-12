// Matched — app orchestration only. Screens and game logic live in
// screens/ and game/; this file wires navigation, the bottom tab bar, and
// the local-first store, then hands each screen its render call.

import { createWorkerApi } from "./api.js";
import { createJsonStorage, normalizeSharedData, LOCAL_KEYS, DEFAULT_SETTINGS } from "./storage.js";
import { createMutationQueue } from "./sync.js";
import { el, TAB_DEFS } from "./screens/shared-ui.js";

import { renderHome } from "./screens/home.js";
import { renderPlayCatalog } from "./screens/play-catalog.js";
import { renderRoomSetup } from "./screens/room-setup.js";
import { renderRanking } from "./screens/ranking.js";
import { renderProfile } from "./screens/profile.js";
import { renderBoard } from "./screens/board.js";
import { renderRaceBoard } from "./screens/race-board.js";
import { renderResults } from "./screens/results.js";
import { renderInvite } from "./screens/invite.js";
import { renderDaily } from "./screens/daily.js";

const jsonStorage = createJsonStorage(localStorage);
const workerApi = createWorkerApi({ baseUrl: window.WORKER_URL || "", appKey: window.APP_KEY || "" });
const mutationQueue = createMutationQueue({ jsonStorage, key: LOCAL_KEYS.pendingQueue });

function loadStore() {
  const raw = jsonStorage.read(LOCAL_KEYS.cacheData, {});
  return normalizeSharedData(raw);
}
function saveStore(store) {
  jsonStorage.write(LOCAL_KEYS.cacheData, store);
}

const state = {
  currentUser: jsonStorage.read(LOCAL_KEYS.currentUser, "") || "You",
  settings: { ...DEFAULT_SETTINGS, ...jsonStorage.read(LOCAL_KEYS.settings, {}) },
  points: jsonStorage.read(LOCAL_KEYS.points, 0),
  dailyStreak: jsonStorage.read(LOCAL_KEYS.dailyStreak, 0),
  lastDailyCompleted: jsonStorage.read(LOCAL_KEYS.lastDailyCompleted, null),
  activeRoomId: jsonStorage.read(LOCAL_KEYS.activeRoom, null),
  store: loadStore(),
  screen: "home",
  screenParams: {},
  lastResult: null,
};

function persist() {
  jsonStorage.write(LOCAL_KEYS.currentUser, state.currentUser);
  jsonStorage.write(LOCAL_KEYS.settings, state.settings);
  jsonStorage.write(LOCAL_KEYS.points, state.points);
  jsonStorage.write(LOCAL_KEYS.dailyStreak, state.dailyStreak);
  jsonStorage.write(LOCAL_KEYS.lastDailyCompleted, state.lastDailyCompleted);
  jsonStorage.write(LOCAL_KEYS.activeRoom, state.activeRoomId);
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
  home: renderHome,
  "play-catalog": renderPlayCatalog,
  "room-setup": renderRoomSetup,
  ranking: renderRanking,
  profile: renderProfile,
  board: renderBoard,
  "race-board": renderRaceBoard,
  results: renderResults,
  invite: renderInvite,
  daily: renderDaily,
};

// Screens not directly reachable from a tab keep whichever tab was active
// (matches Boys Bonanza's TAB_FOR_SCREEN convention).
const TAB_FOR_SCREEN = {
  home: "home",
  "play-catalog": "play-catalog",
  "room-setup": "room-setup",
  ranking: "ranking",
  profile: "profile",
  board: "home",
  "race-board": "home",
  results: "home",
  invite: "home",
  daily: "home",
};

const ctx = {
  state,
  api: workerApi,
  mutationQueue,
  persist,
  toast,
  announce,
  navigate,
};

function navigate(screenId, params = {}) {
  if (!SCREENS[screenId]) throw new Error(`Unknown screen: ${screenId}`);
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

function render() {
  const root = document.getElementById("screen-root");
  root.innerHTML = "";
  const screenEl = el("div", { class: "screen active", id: `screen-${state.screen}` });
  root.appendChild(screenEl);
  renderTabBar();
  SCREENS[state.screen](screenEl, ctx, state.screenParams);
}

// First-run: make sure a user exists locally (and remotely, best-effort).
if (workerApi.configured()) {
  workerApi.registerUser(state.currentUser).catch(() => {});
}

navigate("home");
