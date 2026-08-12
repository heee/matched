// Matched — the board. Real gameplay: free-tile detection, tap-to-select,
// tap-match-to-clear, tray attribution, hint/shuffle/undo, simulated
// opponents, toasts, reactions. See docs/design-reference.html #1f.

import { el, avatarDot, renderTileFace, trayFaceGlyph, formatClock } from "./shared-ui.js";
import {
  isFree, freeTiles, findHintPair, clearPair, restorePair, shuffleRemaining,
  hasMovesRemaining, boardCompletion,
} from "../game/mahjong.js";
import { TILE_W, TILE_H, STEP_X, STEP_Y, LAYER_OFFSET } from "../game/layouts.js";
import { PLAYER_COLORS, pointsForSession, highlightsFromLog } from "../game/scoring.js";

const BOT_INTERVAL_MS = 5200;
const REACTIONS = ["🔥", "😮"];

export function renderBoard(root, ctx, params = {}) {
  const room = ctx.state.store.rooms[params.roomId];
  if (!room) { ctx.navigate("home"); return; }
  ctx.state.activeRoomId = room.id;
  const you = ctx.state.currentUser;
  const isShared = room.mode === "shared";

  const local = {
    selectedId: null,
    hintPair: [],
    tileEls: new Map(),
    history: [], // { removed:[a,b], user }
    toast: null,
    reaction: null,
    botsActive: false,
    stuckWarned: false,
  };

  root.classList.add("bg-felt");

  // ---- header ----
  const header = el("div", { class: "screen-header", style: "padding-top:6px" });
  header.appendChild(el("button", { class: "icon-btn", text: "⌂", onClick: () => ctx.navigate("home") }));
  const titleWrap = el("div", { style: "flex:1;min-width:0" });
  titleWrap.appendChild(el("div", { style: "font:600 15px Figtree,sans-serif;color:#f6f1e4", text: room.title }));
  const subLine = el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.55)" });
  titleWrap.appendChild(subLine);
  header.appendChild(titleWrap);
  const hintBtn = el("button", { class: "icon-btn amber", text: "✦" });
  header.appendChild(hintBtn);
  root.appendChild(header);

  // ---- player score cards ----
  const scoreRow = el("div", { style: "margin:12px 16px 0;display:flex;gap:7px" });
  root.appendChild(scoreRow);

  // ---- board area ----
  const boardArea = el("div", { style: "flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden" });
  const boardViewport = el("div", { style: "position:relative;width:100%;height:230px;display:flex;align-items:center;justify-content:center" });
  const boardWrap = el("div", { style: "position:relative" });
  boardViewport.appendChild(boardWrap);
  boardArea.appendChild(boardViewport);
  const toastEl = el("div", { class: "toast" });
  boardArea.appendChild(toastEl);
  const stuckBanner = el("div", { style: "position:absolute;left:16px;right:16px;bottom:8px;padding:10px 14px;border-radius:12px;background:rgba(217,164,65,.18);border:1px solid rgba(217,164,65,.4);font:600 12.5px Figtree,sans-serif;color:#f2e6cc;text-align:center;display:none" });
  stuckBanner.textContent = "No moves remaining — try Shuffle.";
  boardArea.appendChild(stuckBanner);
  root.appendChild(boardArea);

  // ---- tray ----
  const tray = el("div", { class: "tray" });
  const trayHead = el("div", { style: "display:flex;align-items:center;justify-content:space-between" });
  trayHead.appendChild(el("span", { style: "font:700 10px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(246,241,228,.5)", text: "Cleared" }));
  const trayCount = el("span", { style: "font:11px Figtree,sans-serif;color:rgba(246,241,228,.45)" });
  trayHead.appendChild(trayCount);
  tray.appendChild(trayHead);
  const trayStrip = el("div", { class: "tray-strip" });
  tray.appendChild(trayStrip);
  root.appendChild(tray);

  // ---- controls row ----
  const controls = el("div", { class: "controls-row" });
  const shuffleBtn = el("button", { class: "btn btn-ghost", style: "height:42px;padding:0 16px", text: "Shuffle" });
  const undoBtn = el("button", { class: "btn btn-ghost", style: "height:42px;padding:0 16px", text: "Undo" });
  controls.appendChild(shuffleBtn);
  controls.appendChild(undoBtn);
  controls.appendChild(el("div", { style: "flex:1" }));
  REACTIONS.forEach((emoji) => {
    const btn = el("button", { class: "reaction-btn", text: emoji });
    btn.addEventListener("click", () => {
      sendReaction(emoji);
      floatReaction(emoji);
    });
    controls.appendChild(btn);
  });
  root.appendChild(controls);

  // ===================== rendering =====================

  function playerList() {
    return room.players;
  }

  function renderScoreCards() {
    scoreRow.innerHTML = "";
    playerList().forEach((name, i) => {
      const streak = room.streaks[name] || 0;
      const card = el("div", { class: `player-card${name === you ? " me" : ""}` });
      const top = el("div", { style: "display:flex;align-items:center;gap:6px" });
      top.appendChild(avatarDot(name, i, 18));
      top.appendChild(el("span", { style: "font:700 13px Figtree,sans-serif;color:#f6f1e4", text: String(room.pairsCleared[name] || 0) }));
      card.appendChild(top);
      card.appendChild(el("div", { class: "pname", text: streak >= 2 ? `${streak} streak` : name }));
      scoreRow.appendChild(card);
    });
  }

  function tilePixelBox(tiles) {
    let maxX = 0, maxY = 0, maxZ = 0;
    for (const t of tiles) { maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y); maxZ = Math.max(maxZ, t.z); }
    return {
      width: (maxX + 1) * STEP_X + TILE_W + maxZ * LAYER_OFFSET,
      height: (maxY + 1) * STEP_Y + TILE_H + maxZ * LAYER_OFFSET,
      padTop: maxZ * LAYER_OFFSET,
    };
  }

  // Rebuilds every tile element — only for actual board changes (clear,
  // shuffle, undo, initial load). Selection/hint state alone must never hit
  // this path: destroying and recreating 50+ nodes replays each tile's
  // popIn entrance animation simultaneously (looks like the board
  // "vibrating") and also means the .selected lift/glow can't transition,
  // since the new element starts already in its target state.
  function renderBoardTiles() {
    const tiles = room.state.tiles;
    const free = new Set(freeTiles(tiles).map((t) => t.id));
    const box = tilePixelBox(tiles);
    boardWrap.style.width = `${box.width}px`;
    boardWrap.style.height = `${box.height}px`;
    const availW = boardArea.clientWidth - 24;
    const availH = 220;
    const scale = Math.min(1, availW / box.width, availH / box.height);
    boardWrap.style.transform = `scale(${scale})`;
    boardWrap.innerHTML = "";
    local.tileEls = new Map();

    for (const t of tiles) {
      const isF = free.has(t.id);
      const px = t.x * STEP_X + t.z * LAYER_OFFSET;
      const py = t.y * STEP_Y - t.z * LAYER_OFFSET + box.padTop;
      const cls = ["tile"];
      if (t.z > 0) cls.push("upper");
      if (!isF) cls.push("blocked"); else if (room.freeTilesGlow) cls.push("free", "glow");
      const tileEl = el("div", {
        class: cls.join(" "),
        style: `left:${px}px;top:${py}px;width:${TILE_W}px;height:${TILE_H}px;z-index:${t.z * 100 + t.y}`,
      });
      const face = el("div", { class: "tile-face" });
      renderTileFace(face, t.face);
      tileEl.appendChild(face);
      tileEl.addEventListener("click", () => tap(t.id));
      boardWrap.appendChild(tileEl);
      local.tileEls.set(t.id, tileEl);
    }
    updateTileSelection();
  }

  // Cheap update for selection/hint state: toggles classes on the tile
  // elements that already exist rather than rebuilding the board.
  function updateTileSelection() {
    for (const [id, tileEl] of local.tileEls) {
      tileEl.classList.toggle("selected", local.selectedId === id);
      tileEl.classList.toggle("hinted", local.hintPair.includes(id));
    }
  }

  function renderTray() {
    trayStrip.innerHTML = "";
    const trayItems = room.state.tray.slice(0, 14);
    if (trayItems.length === 0) {
      trayStrip.appendChild(el("div", { class: "empty-note", text: "Matched pairs land here, tinted by who took them." }));
    }
    trayItems.forEach((entry) => {
      const seatIndex = Math.max(0, playerList().indexOf(entry.user));
      const chip = el("div", {
        class: "tray-tile",
        style: `box-shadow:0 0 0 2px ${PLAYER_COLORS[seatIndex % PLAYER_COLORS.length]},0 2px 5px rgba(0,0,0,.35);color:${entry.face.color || "#23201c"}`,
        text: trayFaceGlyph(entry.face),
      });
      trayStrip.appendChild(chip);
    });
    const myPairs = room.pairsCleared[you] || 0;
    const pct = boardCompletion(room.tileCount, room.state.tiles.length);
    trayCount.textContent = `You ${myPairs} ${myPairs === 1 ? "pair" : "pairs"} · board ${pct}%`;
  }

  function renderSub() {
    const remaining = room.state.tiles.length;
    const cleared = room.tileCount - remaining;
    const elapsedS = Math.floor((Date.now() - room.startedAt) / 1000);
    subLine.textContent = `${cleared} of ${room.tileCount} cleared · ${formatClock(elapsedS)}`;
  }

  function renderStuckBanner() {
    const stuck = room.state.tiles.length > 0 && !hasMovesRemaining(room.state.tiles);
    stuckBanner.style.display = stuck ? "block" : "none";
  }

  function fullRender() {
    renderScoreCards();
    renderBoardTiles();
    renderTray();
    renderSub();
    renderStuckBanner();
  }

  // ===================== gameplay =====================

  function showToast(text, seatIndex) {
    local.toast = text;
    toastEl.textContent = text;
    toastEl.style.borderColor = seatIndex == null ? "transparent" : PLAYER_COLORS[seatIndex % PLAYER_COLORS.length];
    toastEl.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  function floatReaction(emoji) {
    const node = el("div", { class: "reaction-float", text: emoji });
    boardArea.appendChild(node);
    setTimeout(() => node.remove(), 1700);
  }

  function sendReaction(emoji) {
    ctx.announce(`${you} reacted ${emoji}`);
  }

  function performClear(idA, idB, user) {
    const result = clearPair(room.state.tiles, idA, idB);
    if (!result) return false;
    room.state.tiles = result.tiles;
    room.pairsCleared[user] = (room.pairsCleared[user] || 0) + 1;
    for (const name of Object.keys(room.streaks)) room.streaks[name] = name === user ? (room.streaks[name] || 0) + 1 : 0;
    // Peak streak (for the profile's "longest streak" stat) is tracked
    // separately from the live streak, which resets whenever anyone else
    // scores — the live value alone would understate a streak that ended
    // before the board finished.
    room.peakStreaks = room.peakStreaks || {};
    room.peakStreaks[user] = Math.max(room.peakStreaks[user] || 0, room.streaks[user]);
    const trayEntry = { id: `${idA}-${idB}`, face: result.removed[0].face, user };
    room.state.tray = [trayEntry, ...room.state.tray].slice(0, 60);
    room.state.matchLog = [...(room.state.matchLog || []), { seat: playerList().indexOf(user), user, at: Date.now() }];
    local.history.push({ removed: result.removed, user });
    local.selectedId = null;
    local.hintPair = [];

    if (user !== you) {
      const streak = room.streaks[user];
      showToast(`${user} took a pair${streak >= 3 ? ` · ${streak} streak` : ""}`, playerList().indexOf(user));
    }
    ctx.persist();
    fullRender();

    if (room.state.tiles.length === 0 && !room.completedAt) {
      room.completedAt = new Date().toISOString();
      room.state.state = "completed";
      finishRoom();
    }
    return true;
  }

  function finishRoom() {
    const elapsedMs = Date.now() - room.startedAt;
    const myPairs = room.pairsCleared[you] || 0;
    const assistsUsed = room.assistsUsed[you] || 0;
    const earned = pointsForSession({ pairsCleared: myPairs, assistsUsed, elapsedMs, tileCount: room.tileCount });
    ctx.state.points += earned;
    ctx.state.activeRoomId = null;
    const highlights = highlightsFromLog(room.state.matchLog || [], Object.fromEntries(playerList().map((p, i) => [i, { name: p }])));
    ctx.state.lastResult = { roomId: room.id, earned, highlights, elapsedMs };
    if (room.isDaily) {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      ctx.state.dailyStreak = ctx.state.lastDailyCompleted === yesterday ? ctx.state.dailyStreak + 1 : 1;
      ctx.state.lastDailyCompleted = today;
    }
    ctx.persist();
    stopBots();
    setTimeout(() => ctx.navigate("results", { roomId: room.id }), 900);
  }

  function tap(id) {
    if (!local.botsActive) startBots();
    const free = freeTiles(room.state.tiles).map((t) => t.id);
    if (!free.includes(id)) return;
    if (local.selectedId === id) { local.selectedId = null; updateTileSelection(); return; }
    if (!local.selectedId) {
      local.selectedId = id;
      local.hintPair = [];
      updateTileSelection();
      return;
    }
    const result = clearPair(room.state.tiles, local.selectedId, id);
    if (result) {
      performClear(local.selectedId, id, you);
    } else {
      local.selectedId = id;
      updateTileSelection();
    }
  }

  function useHint() {
    if (!room.hintsAllowed) { ctx.toast("Hints are off for this room."); return; }
    room.assistsUsed[you] = (room.assistsUsed[you] || 0) + 1;
    const pair = findHintPair(room.state.tiles);
    if (pair) { local.hintPair = pair; local.selectedId = null; updateTileSelection(); }
    else ctx.toast("No matching pair is currently free.");
  }

  function useShuffle() {
    room.assistsUsed[you] = (room.assistsUsed[you] || 0) + 1;
    room.state.tiles = shuffleRemaining(room.state.tiles);
    local.selectedId = null;
    local.hintPair = [];
    ctx.persist();
    fullRender();
  }

  function useUndo() {
    const last = local.history.pop();
    if (!last) { ctx.toast("Nothing to undo."); return; }
    room.state.tiles = restorePair(room.state.tiles, last.removed);
    room.pairsCleared[last.user] = Math.max(0, (room.pairsCleared[last.user] || 0) - 1);
    room.state.tray = room.state.tray.slice(1);
    ctx.persist();
    fullRender();
  }

  hintBtn.addEventListener("click", useHint);
  shuffleBtn.addEventListener("click", useShuffle);
  undoBtn.addEventListener("click", useUndo);

  // ===================== simulated opponents =====================

  let botTimer = null;
  let clockTimer = null;

  function startBots() {
    if (local.botsActive || !isShared) return;
    local.botsActive = true;
    botTimer = setInterval(() => {
      const bots = playerList().filter((p) => p !== you);
      if (bots.length === 0) return;
      const pair = findHintPair(room.state.tiles);
      if (!pair) return;
      const bot = bots[Math.floor(Math.random() * bots.length)];
      performClear(pair[0], pair[1], bot);
    }, BOT_INTERVAL_MS);
  }
  function stopBots() {
    clearInterval(botTimer);
    botTimer = null;
  }

  clockTimer = setInterval(renderSub, 1000);

  window.__matchedCleanup = () => {
    stopBots();
    clearInterval(clockTimer);
  };

  fullRender();
}
