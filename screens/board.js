// Matched — the board. Real gameplay: free-tile detection, tap-to-select,
// tap-match-to-clear, tray attribution, hint/shuffle/undo, simulated
// opponents, toasts, reactions. See docs/design-reference.html #1f.

import { el, avatarDot, renderTileFace, trayFaceGlyph, formatClock, haptic, playMatchSound } from "./shared-ui.js?v=41";
import {
  isFree, freeTiles, findHintPair, clearPair, restorePair, shuffleRemaining,
  hasMovesRemaining, boardCompletion,
} from "../game/mahjong.js";
import { TILE_W, TILE_H, STEP_X, STEP_Y, LAYER_OFFSET } from "../game/layouts.js";
import { PLAYER_COLORS, pointsForSession, highlightsFromLog, BOT_ACT_CHANCE, COMBO_WINDOW_MS, COMBO_BONUS_POINTS } from "../game/scoring.js";
import { equippedMaterialName, materialCssVars } from "../game/materials.js";
import { repairCurrentPlayerAliases } from "../game/identity.js";
import { hasStartedRoom } from "../game/room-lists.js";
import { equippedFeltName, feltCssVars } from "../game/felts.js";
import { createIdleClueController } from "./idle-clues.js";

const BOT_INTERVAL_MS = 5200;
const REACTIONS = ["🔥", "😮", "👏", "😂", "😍", "🎉", "💪", "😱", "👍"];
const REACTIONS_PER_PAGE = 3;
const REACTION_BTN_W = 40;

// Stroke-only control-row icons (Lucide paths) — replaces the old
// text-labeled Shuffle/Undo buttons, plus a new Hint icon for the
// briefly-shine-then-fade hint (previously a persistent gold ring
// triggered from the header, now consolidated here).
const ICON_SHUFFLE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.4c1.3 0 2.5.6 3.3 1.7l.8 1.1"/><path d="M22 18h-1.4c-1.3 0-2.5-.6-3.3-1.7l-.8-1.1"/><path d="m18 14 4 4-4 4"/></svg>`;
const ICON_UNDO = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>`;
const ICON_HINT = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"/></svg>`;

export function renderBoard(root, ctx, params = {}) {
  const room = ctx.state.store.rooms[params.roomId];
  if (!room) { ctx.navigate("home"); return; }
  if (repairCurrentPlayerAliases(room, ctx.state.currentUser)) ctx.persist();
  if (hasStartedRoom(room, ctx.state.currentUser)) ctx.state.activeRoomId = room.id;
  const you = ctx.state.currentUser;
  const isShared = room.mode === "shared";

  const local = {
    selectedId: null,
    tileEls: new Map(),
    history: [], // { removed:[a,b], user }
    toast: null,
    reaction: null,
    botsActive: false,
    stuckWarned: false,
    lastClearAt: 0, // your last successful clear, for combo timing
    comboCount: 0,
    persistTimer: null,
  };
  let clueController = null;

  root.classList.add("bg-felt");
  root.style.cssText += feltCssVars(equippedFeltName(ctx.state.points, ctx.state.equipped));

  // ---- header ----
  const header = el("div", { class: "screen-header", style: "padding-top:6px" });
  header.appendChild(el("button", { class: "icon-btn", text: "⌂", onClick: () => ctx.navigate("home") }));
  const titleWrap = el("div", { style: "flex:1;min-width:0" });
  titleWrap.appendChild(el("div", { style: "font:600 15px Figtree,sans-serif;color:#f6f1e4", text: room.title }));
  const subLine = el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.55)" });
  titleWrap.appendChild(subLine);
  header.appendChild(titleWrap);
  root.appendChild(header);

  // ---- player score cards ----
  const scoreRow = el("div", { style: "margin:12px 16px 0;display:flex;gap:7px" });
  root.appendChild(scoreRow);

  // ---- board area ----
  const boardArea = el("div", { style: "flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;min-height:0" });
  const boardViewport = el("div", { style: "position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center" });
  // The equipped material is applied once here as CSS custom properties;
  // every tile under this wrapper inherits them, so switching material
  // doesn't touch per-tile styling.
  const material = equippedMaterialName(ctx.state.points, ctx.state.equipped);
  const boardWrap = el("div", { class: "board-wrap", style: `position:relative;${materialCssVars(material)}` });
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
  const trayRow = el("div", { class: "tray-row" });
  const trayPrev = el("button", { class: "tray-nav", text: "‹", "aria-label": "Scroll cleared tiles left" });
  const trayNext = el("button", { class: "tray-nav", text: "›", "aria-label": "Scroll cleared tiles right" });
  const trayStrip = el("div", { class: "tray-strip" });
  trayRow.appendChild(trayPrev);
  trayRow.appendChild(trayStrip);
  trayRow.appendChild(trayNext);
  tray.appendChild(trayRow);
  root.appendChild(tray);
  const TRAY_SCROLL_STEP = 33 * 3; // roughly 3 tiles (26px + 7px gap)
  function updateTrayNav() {
    trayPrev.disabled = trayStrip.scrollLeft <= 0;
    trayNext.disabled = trayStrip.scrollLeft + trayStrip.clientWidth >= trayStrip.scrollWidth - 1;
  }
  trayPrev.addEventListener("click", () => trayStrip.scrollBy({ left: -TRAY_SCROLL_STEP, behavior: "smooth" }));
  trayNext.addEventListener("click", () => trayStrip.scrollBy({ left: TRAY_SCROLL_STEP, behavior: "smooth" }));
  trayStrip.addEventListener("scroll", updateTrayNav);

  // ---- controls row ----
  const controls = el("div", { class: "controls-row" });
  const shuffleBtn = el("button", { class: "icon-btn", style: "width:42px;height:42px", html: ICON_SHUFFLE, "aria-label": "Shuffle" });
  const undoBtn = el("button", { class: "icon-btn", style: "width:42px;height:42px", html: ICON_UNDO, "aria-label": "Undo" });
  const hintBtn = el("button", { class: "icon-btn amber", style: "width:42px;height:42px", html: ICON_HINT, "aria-label": "Hint" });
  controls.appendChild(shuffleBtn);
  controls.appendChild(undoBtn);
  controls.appendChild(hintBtn);
  controls.appendChild(el("div", { style: "flex:1" }));

  // Reactions don't make sense with nobody else on the board to see them.
  if (room.mode !== "solo") {
    const pageWidth = REACTIONS_PER_PAGE * REACTION_BTN_W;
    const pageCount = Math.ceil(REACTIONS.length / REACTIONS_PER_PAGE);
    let reactionPage = 0;
    const reactionViewport = el("div", { style: `width:${pageWidth}px;height:36px;overflow:hidden;position:relative;touch-action:pan-y` });
    const reactionStrip = el("div", { style: "display:flex;position:absolute;left:0;top:0" });
    let dragging = false, dragStartX = null, dragDX = 0;

    function positionStrip(animate) {
      reactionStrip.style.transition = animate ? "transform .22s ease" : "none";
      reactionStrip.style.transform = `translateX(${-reactionPage * pageWidth + dragDX}px)`;
    }
    REACTIONS.forEach((emoji) => {
      const btn = el("button", { class: "reaction-btn", style: `width:${REACTION_BTN_W}px;flex:none`, text: emoji });
      btn.addEventListener("click", () => {
        if (dragging) return; // suppress the tap-through after a real swipe
        sendReaction(emoji);
        floatReaction(emoji);
      });
      reactionStrip.appendChild(btn);
    });
    reactionViewport.appendChild(reactionStrip);
    reactionViewport.addEventListener("pointerdown", (e) => {
      dragStartX = e.clientX; dragDX = 0; dragging = false;
      reactionViewport.setPointerCapture(e.pointerId);
    });
    reactionViewport.addEventListener("pointermove", (e) => {
      if (dragStartX == null) return;
      dragDX = e.clientX - dragStartX;
      if (Math.abs(dragDX) > 8) dragging = true;
      if (dragging) positionStrip(false);
    });
    reactionViewport.addEventListener("pointerup", () => {
      if (dragging && Math.abs(dragDX) > 28) {
        reactionPage = Math.max(0, Math.min(pageCount - 1, reactionPage + (dragDX < 0 ? 1 : -1)));
      }
      dragDX = 0;
      dragStartX = null;
      positionStrip(true);
      setTimeout(() => { dragging = false; }, 0); // let this tick's click handler see it was a drag
    });
    controls.appendChild(reactionViewport);
  }
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

  // True bounding box from each tile's actual pixel extent, not a
  // worst-case formula — upper layers are inset from the base layer in
  // basically every layout, so assuming they reach the box's edge (the old
  // width/height formula) left real content sitting left/top-anchored
  // inside an over-sized box with all the slack on the right/bottom.
  function tilePixelBox(tiles) {
    let minPx = 0, maxPx = 0, minPy = 0, maxPy = 0;
    for (const t of tiles) {
      const px = t.x * STEP_X + t.z * LAYER_OFFSET;
      const py = t.y * STEP_Y - t.z * LAYER_OFFSET;
      minPx = Math.min(minPx, px); maxPx = Math.max(maxPx, px + TILE_W);
      minPy = Math.min(minPy, py); maxPy = Math.max(maxPy, py + TILE_H);
    }
    return { width: maxPx - minPx, height: maxPy - minPy, padLeft: -minPx, padTop: -minPy };
  }

  // Rebuilds every tile element — only for actual board changes (clear,
  // shuffle, undo, initial load). Selection/hint state alone must never hit
  // this path: destroying and recreating 50+ nodes replays each tile's
  // popIn entrance animation simultaneously (looks like the board
  // "vibrating") and also means the .selected lift/glow can't transition,
  // since the new element starts already in its target state.
  // Scales boardWrap to fill ~85% of boardArea's actual box (both axes,
  // whichever is tighter) rather than a fixed pixel budget — re-run on
  // resize so the board keeps tracking the viewport instead of being
  // frozen at whatever size it first rendered at. Uncapped below 1 (small
  // boards get scaled up too) but capped above so tiles never blow up past
  // legible size on a huge window.
  const BOARD_FILL = 0.85;
  const BOARD_MAX_SCALE = 1.9;
  function applyBoardScale() {
    // Uses the cached full-board box, not the live (shrinking) tile set —
    // see syncBoardTiles for why recomputing per-clear causes a stutter.
    const box = local.boardBox || tilePixelBox(room.state.tiles);
    if (box.width === 0 || box.height === 0) return;
    const availW = boardArea.clientWidth * BOARD_FILL;
    const availH = boardArea.clientHeight * BOARD_FILL;
    const scale = Math.min(availW / box.width, availH / box.height, BOARD_MAX_SCALE);
    boardWrap.style.transform = `scale(${scale})`;
  }

  function renderBoardTiles() {
    const tiles = room.state.tiles;
    const free = new Set(freeTiles(tiles).map((t) => t.id));
    // Cached so syncBoardTiles (per-clear) doesn't recompute it from the
    // shrinking tile set — see syncBoardTiles for why that matters.
    const box = local.boardBox = tilePixelBox(tiles);
    boardWrap.style.width = `${box.width}px`;
    boardWrap.style.height = `${box.height}px`;
    applyBoardScale();
    boardWrap.innerHTML = "";
    local.tileEls = new Map();

    for (const t of tiles) {
      const isF = free.has(t.id);
      const px = t.x * STEP_X + t.z * LAYER_OFFSET + box.padLeft;
      const py = t.y * STEP_Y - t.z * LAYER_OFFSET + box.padTop;
      const cls = ["tile"];
      if (t.z > 0) cls.push("upper");
      if (!isF) cls.push("blocked"); else if (room.freeTilesGlow && ctx.state.settings.freeTilesGlow) cls.push("free", "glow");
      const tileEl = el("div", {
        class: cls.join(" "),
        style: `left:${px}px;top:${py}px;width:${TILE_W}px;height:${TILE_H}px;z-index:${t.z * 100 + t.y}`,
      });
      const face = el("div", { class: "tile-face" });
      renderTileFace(face, t.face, material);
      tileEl.appendChild(face);
      tileEl.addEventListener("click", () => { clueController?.reset(); tap(t.id); });
      boardWrap.appendChild(tileEl);
      local.tileEls.set(t.id, tileEl);
    }
    updateTileSelection();
  }

  // Keeps the existing tile nodes after a clear. Rebuilding the whole board
  // here used to restart every surviving tile's entrance animation while the
  // two tray clones were also moving, which caused a visible hitch. Only
  // free-state classes can change after a clear; positions and scale cannot.
  //
  // Box is the cached one from the last full render, NOT recomputed from
  // the post-clear tile set: recomputing here shrank the bounding box
  // whenever a cleared pair sat on its edge, which shifted padLeft/padTop
  // (and boardWrap's size, feeding applyBoardScale) and snapped every
  // surviving tile to a new position on every single match — the stutter.
  function syncBoardTiles(removedIds = []) {
    for (const id of removedIds) {
      local.tileEls.get(id)?.remove();
      local.tileEls.delete(id);
    }

    const tiles = room.state.tiles;
    const free = new Set(freeTiles(tiles).map((t) => t.id));
    for (const t of tiles) {
      const tileEl = local.tileEls.get(t.id);
      if (!tileEl) continue;
      const isF = free.has(t.id);
      tileEl.classList.toggle("blocked", !isF);
      const glow = isF && room.freeTilesGlow && ctx.state.settings.freeTilesGlow;
      tileEl.classList.toggle("free", glow);
      tileEl.classList.toggle("glow", glow);
      tileEl.classList.remove("selected");
    }
  }

  // Cheap update for selection/hint state: toggles classes on the tile
  // elements that already exist rather than rebuilding the board.
  function updateTileSelection() {
    for (const [id, tileEl] of local.tileEls) {
      tileEl.classList.toggle("selected", local.selectedId === id);
    }
  }

  function renderTray() {
    const trayItems = room.state.tray.slice(0, 14);
    const existing = new Map(
      [...trayStrip.querySelectorAll(".tray-tile[data-entry-id]")].map((node) => [node.dataset.entryId, node]),
    );
    const nodes = [];
    if (trayItems.length === 0) {
      nodes.push(el("div", { class: "empty-note", text: "Matched pairs land here, tinted by who took them." }));
    }
    trayItems.forEach((entry) => {
      let chip = existing.get(entry.id);
      if (!chip) {
        const seatIndex = Math.max(0, playerList().indexOf(entry.user));
        chip = el("div", {
          class: "tray-tile entering",
          "data-entry-id": entry.id,
          style: `box-shadow:0 0 0 2px ${PLAYER_COLORS[seatIndex % PLAYER_COLORS.length]},0 2px 5px rgba(0,0,0,.35);color:${entry.face.color || "#23201c"}`,
          text: trayFaceGlyph(entry.face),
        });
        chip.addEventListener("animationend", () => chip.classList.remove("entering"), { once: true });
      }
      nodes.push(chip);
    });
    trayStrip.replaceChildren(...nodes);
    const myPairs = room.pairsCleared[you] || 0;
    const pct = boardCompletion(room.tileCount, room.state.tiles.length);
    trayCount.textContent = `You ${myPairs} ${myPairs === 1 ? "pair" : "pairs"} · board ${pct}%`;
    updateTrayNav();
  }

  function renderSub() {
    const remaining = room.state.tiles.length;
    const cleared = room.tileCount - remaining;
    const elapsedS = Math.floor((Date.now() - (room.startedAt || Date.now())) / 1000);
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

  // Concurrent reactions used to all spawn at the exact same spot and just
  // overlay each other, so rapid taps looked like one stuck emoji instead
  // of each tap registering. Each new one now stacks above however many
  // are still animating, so a burst of taps visibly piles up and fades
  // out top to bottom instead of blending into a single glyph.
  let activeReactionCount = 0;
  function floatReaction(emoji) {
    const stackOffset = activeReactionCount * 32;
    activeReactionCount++;
    const node = el("div", { class: "reaction-float", text: emoji, style: `bottom:${96 + stackOffset}px` });
    boardArea.appendChild(node);
    setTimeout(() => {
      node.remove();
      activeReactionCount = Math.max(0, activeReactionCount - 1);
    }, 1700);
  }

  function sendReaction(emoji) {
    ctx.announce(`${you} reacted ${emoji}`);
  }

  // localStorage serializes the whole room synchronously. Delay and coalesce
  // writes so match-flight frames are not blocked by a large JSON write.
  function schedulePersist() {
    clearTimeout(local.persistTimer);
    local.persistTimer = setTimeout(() => {
      local.persistTimer = null;
      ctx.reportRoomProgress(room);
    }, 120);
  }

  function performClear(idA, idB, user) {
    const result = clearPair(room.state.tiles, idA, idB);
    if (!result) return false;
    room.state.tiles = result.tiles;
    room.pairsCleared[user] = (room.pairsCleared[user] || 0) + 1;
    if (user === you && room.createdBy !== you && room.pairsCleared[user] === 1) {
      ctx.commitRoomMembership(room);
    }
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

    if (user !== you) {
      const streak = room.streaks[user];
      showToast(`${user} took a pair${streak >= 3 ? ` · ${streak} streak` : ""}`, playerList().indexOf(user));
    }
    schedulePersist();
    syncBoardTiles([idA, idB]);
    renderScoreCards();
    renderTray();
    renderSub();
    renderStuckBanner();

    if (room.state.tiles.length === 0 && !room.completedAt) {
      room.completedAt = new Date().toISOString();
      room.state.state = "completed";
      finishRoom();
    }
    return true;
  }

  function finishRoom() {
    const elapsedMs = Date.now() - (room.startedAt || Date.now());
    room.elapsedMs = elapsedMs;
    const myPairs = room.pairsCleared[you] || 0;
    const assistsUsed = room.assistsUsed[you] || 0;
    const comboBonus = (room.comboBonus && room.comboBonus[you]) || 0;
    const earned = pointsForSession({ pairsCleared: myPairs, assistsUsed, elapsedMs, tileCount: room.tileCount }) + comboBonus;
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
    ctx.reportCompletedRoom(room);
    stopBots();
    setTimeout(() => ctx.navigate("results", { roomId: room.id }), 900);
  }

  // Sends copies of the two matched tiles flying from their board position
  // to the tray, while the real board/tray update instantly underneath —
  // the clones are just a visual echo, not on the game-state critical path.
  function flyToTray(idA, idB) {
    const trayRect = trayStrip.getBoundingClientRect();
    [idA, idB].map((id) => local.tileEls.get(id)).filter(Boolean).forEach((tileEl) => {
      const rect = tileEl.getBoundingClientRect();
      const logicalWidth = tileEl.offsetWidth;
      const logicalHeight = tileEl.offsetHeight;
      if (!logicalWidth || !logicalHeight) return;

      const stage = el("div", { class: "match-flight" });
      const scaled = el("div", { class: "match-flight-scale" });
      const clone = tileEl.cloneNode(true);
      clone.classList.remove("selected", "free", "glow", "blocked", "shine", "shake", "shuffle-fly");
      const dx = trayRect.left + trayRect.width / 2 - (rect.left + rect.width / 2);
      const dy = trayRect.top + trayRect.height / 2 - (rect.top + rect.height / 2);
      Object.assign(stage.style, {
        left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
      });
      stage.style.setProperty("--fly-dx", `${dx}px`);
      stage.style.setProperty("--fly-dy", `${dy}px`);
      stage.style.setProperty("--fly-x1", `${dx * 0.04}px`);
      stage.style.setProperty("--fly-x2", `${dx * 0.42}px`);
      stage.style.setProperty("--fly-y2", `${dy * 0.24 - 24}px`);
      Object.assign(scaled.style, {
        width: `${logicalWidth}px`, height: `${logicalHeight}px`,
        transform: `scale(${rect.width / logicalWidth},${rect.height / logicalHeight})`,
      });
      Object.assign(clone.style, {
        position: "absolute", left: "0", top: "0", width: `${logicalWidth}px`, height: `${logicalHeight}px`,
        margin: "0", zIndex: "auto",
      });
      const computed = getComputedStyle(tileEl);
      for (const prop of ["--tile-a", "--tile-b", "--tile-edge", "--tile-upper", "--tile-ink"]) {
        stage.style.setProperty(prop, computed.getPropertyValue(prop));
      }
      scaled.appendChild(clone);
      stage.appendChild(scaled);
      document.body.appendChild(stage);

      // Start the compositor animations directly. The previous class toggle
      // happened in the first requestAnimationFrame after insertion; Safari
      // can coalesce that with the insertion and never observe a pre-animation
      // style, leaving the clone with no visible flight at all.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && typeof stage.animate === "function") {
        const timing = { duration: 760, easing: "cubic-bezier(.22,.72,.24,1)", fill: "both" };
        stage.animate([
          { transform: "translate3d(0,0,0) scale(1)", opacity: 1, offset: 0 },
          { transform: `translate3d(${dx * 0.04}px,-28px,0) scale(1.06)`, opacity: 1, offset: 0.24 },
          { transform: `translate3d(${dx * 0.42}px,${dy * 0.24 - 24}px,0) scale(.9)`, opacity: 1, offset: 0.62 },
          { transform: `translate3d(${dx}px,${dy}px,0) scale(.25)`, opacity: 0, offset: 1 },
        ], timing);
        clone.animate([
          { transform: "rotateY(0deg)" },
          { transform: "rotateY(720deg)" },
        ], { duration: 760, easing: "linear", fill: "both" });
      } else if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // Older browsers without Web Animations still get the CSS version;
        // two frames keep insertion and animation start in separate paints.
        requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add("is-flying")));
      }
      setTimeout(() => stage.remove(), 900);
    });
  }

  // A quick pop-and-fade badge plus a small burst of sparks off the
  // matched pair — purely decorative, fired alongside (not blocking) the
  // real clear. midX/midY are viewport coordinates, board-relative.
  function celebrateCombo(comboCount, bonus, midX, midY) {
    const badge = el("div", { class: "combo-badge", text: `Combo x${comboCount} +${bonus}` });
    Object.assign(badge.style, { left: `${midX}px`, top: `${midY}px` });
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 1000);

    const sparkCount = 8;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 34 + Math.random() * 22;
      const spark = el("div", { class: "combo-spark" });
      Object.assign(spark.style, {
        left: `${midX}px`, top: `${midY}px`,
        "--dx": `${Math.cos(angle) * dist}px`, "--dy": `${Math.sin(angle) * dist}px`,
      });
      document.body.appendChild(spark);
      setTimeout(() => spark.remove(), 700);
    }
  }

  // Heavy wiggle on both tiles, then a clean slate — no tile stays selected
  // after a miss, per the "start clean" request.
  function shakeMismatch(idA, idB) {
    haptic(ctx.state.settings.haptic, [12, 40, 12]);
    local.selectedId = null;
    updateTileSelection();
    for (const id of [idA, idB]) {
      const tileEl = local.tileEls.get(id);
      if (!tileEl) continue;
      tileEl.classList.remove("shake");
      void tileEl.offsetWidth; // restart the animation even if one is mid-shake
      tileEl.classList.add("shake");
      tileEl.addEventListener("animationend", () => tileEl.classList.remove("shake"), { once: true });
    }
  }

  function tap(id) {
    if (!local.botsActive) startBots();
    const free = freeTiles(room.state.tiles).map((t) => t.id);
    if (!free.includes(id)) return;
    if (local.selectedId === id) { local.selectedId = null; updateTileSelection(); return; }
    if (!local.selectedId) {
      local.selectedId = id;
      updateTileSelection();
      return;
    }
    const firstId = local.selectedId;
    const result = clearPair(room.state.tiles, firstId, id);
    if (result) {
      haptic(ctx.state.settings.haptic);
      playMatchSound(ctx.state.settings.sound, material);

      // Combo: your own clears landing within COMBO_WINDOW_MS of each
      // other. The first clear in a chain never qualifies (nothing before
      // it to be "quick" relative to) — comboCount tracks the run length.
      const now = Date.now();
      const isCombo = local.lastClearAt && now - local.lastClearAt <= COMBO_WINDOW_MS;
      local.comboCount = isCombo ? local.comboCount + 1 : 1;
      local.lastClearAt = now;
      if (isCombo) {
        room.comboBonus = room.comboBonus || {};
        room.comboBonus[you] = (room.comboBonus[you] || 0) + COMBO_BONUS_POINTS;
        const elA = local.tileEls.get(firstId);
        const elB = local.tileEls.get(id);
        if (elA && elB) {
          const rA = elA.getBoundingClientRect();
          const rB = elB.getBoundingClientRect();
          celebrateCombo(local.comboCount, COMBO_BONUS_POINTS, (rA.left + rA.right + rB.left + rB.right) / 4, (rA.top + rA.bottom + rB.top + rB.bottom) / 4);
        }
      }

      flyToTray(firstId, id);
      performClear(firstId, id, you);
    } else {
      shakeMismatch(firstId, id);
    }
  }

  // Briefly shines a bright outline on a random available pair, then fades
  // — transient, unlike the old persistent hint ring, so it never fights
  // with tap-to-select state.
  function useHint() {
    if (!room.hintsAllowed) { ctx.toast("Hints are off for this room."); return; }
    room.assistsUsed[you] = (room.assistsUsed[you] || 0) + 1;
    const pair = findHintPair(room.state.tiles);
    if (!pair) { ctx.toast("No matching pair is currently free."); return; }
    for (const id of pair) {
      const tileEl = local.tileEls.get(id);
      if (!tileEl) continue;
      tileEl.classList.remove("shine");
      void tileEl.offsetWidth; // restart the animation if a previous shine is still fading
      tileEl.classList.add("shine");
      tileEl.addEventListener("animationend", () => tileEl.classList.remove("shine"), { once: true });
    }
  }

  function useShuffle() {
    const oldPos = new Map();
    for (const [id, tileEl] of local.tileEls) {
      oldPos.set(id, { left: parseFloat(tileEl.style.left), top: parseFloat(tileEl.style.top) });
    }
    room.assistsUsed[you] = (room.assistsUsed[you] || 0) + 1;
    room.state.tiles = shuffleRemaining(room.state.tiles);
    local.selectedId = null;
    ctx.persist();
    fullRender();

    // Wild fly-in: every tile starts back at wherever it used to sit,
    // swings out through a random scattered point, then settles into its
    // real new spot — tiles with no previous position (board just grew,
    // shouldn't happen here but be safe) just pop in from center.
    for (const [id, tileEl] of local.tileEls) {
      const prev = oldPos.get(id);
      const newLeft = parseFloat(tileEl.style.left);
      const newTop = parseFloat(tileEl.style.top);
      tileEl.style.setProperty("--sx0", prev ? `${prev.left - newLeft}px` : "0px");
      tileEl.style.setProperty("--sy0", prev ? `${prev.top - newTop}px` : "0px");
      tileEl.style.setProperty("--srot0", `${(Math.random() - 0.5) * 30}deg`);
      tileEl.style.setProperty("--sx1", `${(Math.random() - 0.5) * 260}px`);
      tileEl.style.setProperty("--sy1", `${(Math.random() - 0.5) * 260}px`);
      tileEl.style.setProperty("--srot1", `${(Math.random() - 0.5) * 140}deg`);
      tileEl.classList.add("shuffle-fly");
      tileEl.addEventListener("animationend", () => tileEl.classList.remove("shuffle-fly"), { once: true });
    }
  }

  function useUndo() {
    const last = local.history.pop();
    if (!last) { ctx.toast("Nothing to undo."); return; }
    room.state.tiles = restorePair(room.state.tiles, last.removed);
    room.pairsCleared[last.user] = Math.max(0, (room.pairsCleared[last.user] || 0) - 1);
    room.state.tray = room.state.tray.slice(1);
    const matchLog = room.state.matchLog || [];
    const matchIndex = matchLog.map((match) => match.user).lastIndexOf(last.user);
    if (matchIndex >= 0) matchLog.splice(matchIndex, 1);
    room.state.matchLog = matchLog;
    ctx.reportRoomProgress(room);
    fullRender();
  }

  hintBtn.addEventListener("click", () => { clueController?.reset(); useHint(); });
  shuffleBtn.addEventListener("click", () => { clueController?.reset(); useShuffle(); });
  undoBtn.addEventListener("click", () => { clueController?.reset(); useUndo(); });

  // ===================== simulated opponents =====================

  let botTimer = null;
  let clockTimer = null;

  function startBots() {
    if (local.botsActive || !isShared) return;
    local.botsActive = true;
    botTimer = setInterval(() => {
      const bots = (room.botNames || []).filter((name) => name !== you && playerList().includes(name));
      if (bots.length === 0) return;
      const pair = findHintPair(room.state.tiles);
      if (!pair) return;
      // Harder bots are more likely to be the one who claims a free pair
      // this tick — a "roll" per bot weighted by its difficulty, falling
      // back to a uniform pick among all bots if nobody rolls successfully
      // (keeps something happening even with an all-easy table).
      const difficulty = room.botDifficulty || {};
      const eligible = bots.filter((b) => Math.random() < (BOT_ACT_CHANCE[difficulty[b]] ?? BOT_ACT_CHANCE.medium));
      const pool = eligible.length ? eligible : bots;
      const bot = pool[Math.floor(Math.random() * pool.length)];
      flyToTray(pair[0], pair[1]);
      performClear(pair[0], pair[1], bot);
    }, BOT_INTERVAL_MS);
  }
  function stopBots() {
    clearInterval(botTimer);
    botTimer = null;
  }

  clockTimer = setInterval(renderSub, 1000);
  window.addEventListener("resize", applyBoardScale);

  window.__matchedCleanup = () => {
    stopBots();
    clueController?.stop();
    clearInterval(clockTimer);
    if (local.persistTimer) {
      clearTimeout(local.persistTimer);
      local.persistTimer = null;
      ctx.reportRoomProgress(room);
    }
    window.removeEventListener("resize", applyBoardScale);
  };

  fullRender();
  clueController = createIdleClueController({
    enabled: ctx.state.settings.provideClues && room.hintsAllowed,
    getTiles: () => room.state.tiles,
    getTileElement: (id) => local.tileEls.get(id),
  });
}
