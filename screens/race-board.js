// Matched — Race board. Same layout, separate boards; night-slate felt;
// live progress bars ordered by position; standings surface in a bottom
// strip instead of a toast; no tray. See docs/design-reference.html #1h.

import { el, avatarDot, renderTileFace, formatClock, haptic, playMatchSound } from "./shared-ui.js?v=41";
import { freeTiles, findHintPair, clearPair, hasMovesRemaining } from "../game/mahjong.js";
import { TILE_W, TILE_H, STEP_X, STEP_Y, LAYER_OFFSET } from "../game/layouts.js";
import { PLAYER_COLORS, BOT_ACT_CHANCE, pointsForSession } from "../game/scoring.js";
import { equippedMaterialName, materialCssVars } from "../game/materials.js";
import { ensureRacer } from "../game/room.js?v=3";
import { repairCurrentPlayerAliases } from "../game/identity.js";
import { hasStartedRoom } from "../game/room-lists.js?v=2";
import { equippedFeltName, feltCssVars } from "../game/felts.js";
import { createIdleClueController } from "./idle-clues.js";
import { elapsedMsSince, timestampMs } from "../game/time.js";
import { createRoomSocket } from "../sync.js?v=41";

const BOT_INTERVAL_MS = 4200;

export function renderRaceBoard(root, ctx, params = {}) {
  const room = ctx.state.store.rooms[params.roomId];
  if (!room) { ctx.navigate("home"); return; }
  if (repairCurrentPlayerAliases(room, ctx.state.currentUser)) ctx.persist();
  const you = ctx.state.currentUser;
  // Self-heals rooms synced from a server build that (until recently)
  // never wrote a `racers` field at all — without this, opening one of
  // those silently bounced back to home with no error.
  if (!room.racers || !room.racers[you]) { ensureRacer(room, you); ctx.persist(); }
  if (hasStartedRoom(room, ctx.state.currentUser)) ctx.state.activeRoomId = room.id;
  const totalPairs = room.tileCount / 2;
  let startedAtMs = timestampMs(room.startedAt);
  if (startedAtMs == null) {
    startedAtMs = Date.now();
    room.startedAt = startedAtMs;
    ctx.persist();
  }

  const local = { selectedId: null, lastStandingLeader: null, tileEls: new Map(), boardBox: null, fixedBoardBox: null, roomSocket: null, finished: false };
  let clueController = null;
  root.classList.add("bg-felt");
  root.style.cssText += feltCssVars(equippedFeltName(ctx.state.points, ctx.state.equipped));

  const header = el("div", { class: "screen-header", style: "padding-top:6px" });
  header.appendChild(el("button", { class: "icon-btn", text: "⌂", onClick: () => ctx.navigate("home") }));
  const titleWrap = el("div", { style: "flex:1" });
  titleWrap.appendChild(el("div", { style: "font:600 15px Figtree,sans-serif;color:#f0f4f3", text: `Race · ${room.title}` }));
  const subLine = el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(240,244,243,.55)", text: "Same layout, own board" });
  titleWrap.appendChild(subLine);
  header.appendChild(titleWrap);
  header.appendChild(el("div", { class: "icon-btn amber", text: "✦" }));
  root.appendChild(header);

  const racersCard = el("div", { style: "margin:12px 16px 0;padding:12px;border-radius:16px;background:rgba(0,0,0,.26);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:10px" });
  root.appendChild(racersCard);

  const boardArea = el("div", { style: "flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-height:0" });
  const boardViewport = el("div", { style: "position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center" });
  const material = equippedMaterialName(ctx.state.points, ctx.state.equipped);
  const boardWrap = el("div", { class: `board-wrap${ctx.state.settings.autoResizeBoard ? " auto-resize" : ""}`, style: `position:relative;${materialCssVars(material)}` });
  boardViewport.appendChild(boardWrap);
  boardArea.appendChild(boardViewport);
  root.appendChild(boardArea);

  const strip = el("div", { style: "margin:0 16px 22px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.08);display:none;align-items:center;gap:10px" });
  strip.appendChild(el("span", { style: "font-size:17px", text: "😮" }));
  const stripText = el("span", { style: "font:13px/1.35 Figtree,sans-serif;color:rgba(240,244,243,.8)" });
  strip.appendChild(stripText);
  root.appendChild(strip);

  function pct(player) {
    return Math.round(((room.pairsCleared[player] || 0) / totalPairs) * 100);
  }

  function renderRacers() {
    racersCard.innerHTML = "";
    const ordered = [...room.players].sort((a, b) => pct(b) - pct(a));
    ordered.forEach((name) => {
      const seat = room.players.indexOf(name);
      const row = el("div", { style: "display:flex;align-items:center;gap:9px" });
      row.appendChild(avatarDot(name, seat, 26));
      const info = el("div", { style: "flex:1;min-width:0" });
      const top = el("div", { style: "display:flex;justify-content:space-between;align-items:baseline" });
      top.appendChild(el("span", { style: `font:${name === you ? 700 : 500} 13px Figtree,sans-serif;color:#f0f4f3`, text: name }));
      top.appendChild(el("span", { style: "font:600 11px Figtree,sans-serif;color:rgba(240,244,243,.6)", text: `${pct(name)}%` }));
      info.appendChild(top);
      info.appendChild(el("div", { class: "progress-thin", style: "margin-top:5px;height:6px", html: `<div style="width:${pct(name)}%;background:${PLAYER_COLORS[seat % PLAYER_COLORS.length]}"></div>` }));
      row.appendChild(info);
      racersCard.appendChild(row);
    });

    const leader = ordered[0];
    if (leader !== local.lastStandingLeader && local.lastStandingLeader != null) {
      stripText.textContent = `${leader} just took the lead with ${totalPairs - (room.pairsCleared[leader] || 0)} pairs left.`;
      strip.style.display = "flex";
    }
    local.lastStandingLeader = leader;
  }

  // True bounding box from actual tile extents — see board.js's
  // tilePixelBox for why the old worst-case-width formula left the board
  // sitting left-anchored inside an over-sized box.
  function tilePixelBox(tiles) {
    if (tiles.length === 0) return { width: 0, height: 0, padLeft: 0, padTop: 0 };
    let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity;
    for (const t of tiles) {
      const px = t.x * STEP_X + t.z * LAYER_OFFSET;
      const py = t.y * STEP_Y - t.z * LAYER_OFFSET;
      minPx = Math.min(minPx, px); maxPx = Math.max(maxPx, px + TILE_W);
      minPy = Math.min(minPy, py); maxPy = Math.max(maxPy, py + TILE_H);
    }
    return { width: maxPx - minPx, height: maxPy - minPy, padLeft: -minPx, padTop: -minPy };
  }

  const BOARD_FILL = 0.85;
  const BOARD_MAX_SCALE = 1.9;
  function applyBoardScale() {
    const box = local.boardBox || tilePixelBox(room.racers[you].tiles);
    if (box.width === 0 || box.height === 0) return;
    const scale = Math.min((boardArea.clientWidth * BOARD_FILL) / box.width, (boardArea.clientHeight * BOARD_FILL) / box.height, BOARD_MAX_SCALE);
    boardWrap.style.transform = `scale(${scale})`;
  }

  // Full rebuild — only for actual tile changes (clear, initial load). See
  // board.js's renderBoardTiles for why selection alone must not hit this:
  // recreating every node replays each tile's popIn entrance at once
  // (looks like the board "vibrating") and can't transition .selected.
  function renderMyBoard() {
    const mine = room.racers[you];
    const tiles = mine.tiles;
    const free = new Set(freeTiles(tiles).map((t) => t.id));
    local.fixedBoardBox ||= tilePixelBox(tiles);
    const box = local.boardBox = ctx.state.settings.autoResizeBoard ? tilePixelBox(tiles) : local.fixedBoardBox;
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
      if (!isF) cls.push("blocked");
      else if (room.freeTilesGlow && ctx.state.settings.freeTilesGlow) cls.push("free", "glow");
      const tileEl = el("div", { class: cls.join(" "), style: `left:${px}px;top:${py}px;width:${TILE_W}px;height:${TILE_H}px;z-index:${t.z * 100 + t.y}` });
      const face = el("div", { class: "tile-face" });
      renderTileFace(face, t.face, material);
      tileEl.appendChild(face);
      tileEl.addEventListener("click", () => { clueController?.reset(); tap(t.id); });
      boardWrap.appendChild(tileEl);
      local.tileEls.set(t.id, tileEl);
    }
    updateTileSelection();
  }

  function updateTileSelection() {
    for (const [id, tileEl] of local.tileEls) {
      tileEl.classList.toggle("selected", local.selectedId === id);
    }
  }

  function shakeMismatch(idA, idB) {
    haptic(ctx.state.settings.haptic, [12, 40, 12]);
    local.selectedId = null;
    updateTileSelection();
    for (const id of [idA, idB]) {
      const tileEl = local.tileEls.get(id);
      if (!tileEl) continue;
      tileEl.classList.remove("shake");
      void tileEl.offsetWidth;
      tileEl.classList.add("shake");
      tileEl.addEventListener("animationend", () => tileEl.classList.remove("shake"), { once: true });
    }
  }

  function tap(id) {
    const mine = room.racers[you];
    const free = freeTiles(mine.tiles).map((t) => t.id);
    if (!free.includes(id)) return;
    if (local.selectedId === id) { local.selectedId = null; updateTileSelection(); return; }
    if (!local.selectedId) { local.selectedId = id; updateTileSelection(); return; }
    const firstId = local.selectedId;
    const result = clearPair(mine.tiles, firstId, id);
    if (result) {
      haptic(ctx.state.settings.haptic);
      playMatchSound(ctx.state.settings.sound, material);
      if (local.roomSocket) {
        local.selectedId = null;
        updateTileSelection();
        local.roomSocket.send({ type: "race-clear-pair", idA: firstId, idB: id });
        return;
      }
      mine.tiles = result.tiles;
      room.pairsCleared[you] = (room.pairsCleared[you] || 0) + 1;
      room.state.state = "in_progress";
      if (room.pairsCleared[you] === 1) {
        ctx.commitRoomMembership(room);
      }
      room.state.matchLog = [...(room.state.matchLog || []), { user: you, at: Date.now() }];
      local.selectedId = null;
      ctx.reportRoomProgress(room);
      renderRacers();
      renderMyBoard();
      if (mine.tiles.length === 0) finishRace();
    } else {
      shakeMismatch(firstId, id);
    }
  }

  function finishRace() {
    if (local.finished) return;
    local.finished = true;
    stopBots();
    room.completedAt = room.completedAt || new Date().toISOString();
    room.state.state = "completed";
    const elapsedMs = elapsedMsSince(startedAtMs, Date.now());
    room.elapsedMs = elapsedMs;
    const myPairs = room.pairsCleared[you] || 0;
    const assistsUsed = room.assistsUsed[you] || 0;
    const earned = pointsForSession({ pairsCleared: myPairs, assistsUsed, elapsedMs, tileCount: room.tileCount });
    ctx.state.points += earned;
    ctx.state.lastResult = { roomId: room.id, earned, highlights: [], elapsedMs };
    ctx.state.activeRoomId = null;
    if (local.roomSocket) ctx.persist();
    else ctx.reportCompletedRoom(room);
    ctx.navigate("results", { roomId: room.id });
  }

  let botTimer = setInterval(() => {
    const bots = (room.botNames || []).filter((name) => name !== you && room.players.includes(name));
    const difficulty = room.botDifficulty || {};
    for (const bot of bots) {
      const racer = room.racers[bot];
      if (!racer || racer.tiles.length === 0) continue;
      const pair = findHintPair(racer.tiles);
      if (!pair) continue;
      const chance = BOT_ACT_CHANCE[difficulty[bot]] ?? BOT_ACT_CHANCE.medium;
      if (Math.random() > chance) continue; // don't clear on every tick, keeps it a real race
      if (local.roomSocket) {
        local.roomSocket.send({ type: "race-clear-pair", idA: pair[0], idB: pair[1], user: bot });
        continue;
      }
      const result = clearPair(racer.tiles, pair[0], pair[1]);
      if (result) {
        racer.tiles = result.tiles;
        room.pairsCleared[bot] = (room.pairsCleared[bot] || 0) + 1;
        room.state.matchLog = [...(room.state.matchLog || []), { user: bot, at: Date.now() }];
      }
    }
    renderRacers();
  }, BOT_INTERVAL_MS);

  function stopBots() { clearInterval(botTimer); botTimer = null; }
  window.addEventListener("resize", applyBoardScale);
  window.__matchedCleanup = () => {
    stopBots();
    clueController?.stop();
    local.roomSocket?.close();
    window.removeEventListener("resize", applyBoardScale);
  };

  renderRacers();
  renderMyBoard();
  if (ctx.api.configured()) {
    local.roomSocket = createRoomSocket({
      url: ctx.api.wsUrl(room.id, you),
      onMessage: (message) => {
        if (message.type === "init" || message.type === "room-sync") {
          if (message.room) {
            Object.assign(room, message.room);
            repairCurrentPlayerAliases(room, you);
            if (!room.racers?.[you]) ensureRacer(room, you);
            startedAtMs = timestampMs(room.startedAt) ?? startedAtMs;
            local.selectedId = null;
            local.boardBox = null;
            local.fixedBoardBox = null;
            ctx.persist();
            renderRacers();
            renderMyBoard();
            if (room.completedAt) finishRace();
          }
          return;
        }
        if (message.type === "race-cleared") {
          room.players = message.players || room.players;
          room.startedPlayers = message.startedPlayers || room.startedPlayers;
          room.pairsCleared = message.pairsCleared || room.pairsCleared;
          room.streaks = message.streaks || room.streaks;
          room.peakStreaks = message.peakStreaks || room.peakStreaks;
          if (message.startedAt) {
            room.startedAt = message.startedAt;
            startedAtMs = timestampMs(message.startedAt) ?? startedAtMs;
          }
          if (message.user === you) {
            const result = clearPair(room.racers[you].tiles, message.idA, message.idB);
            if (result) room.racers[you].tiles = result.tiles;
            local.selectedId = null;
            renderMyBoard();
          }
          room.state.state = message.completed ? "completed" : "in_progress";
          if (message.completedAt) room.completedAt = message.completedAt;
          ctx.persist();
          renderRacers();
          if (message.completed) finishRace();
          return;
        }
        if (message.type === "room-deleted") ctx.navigate("home");
      },
    });
  }
  clueController = createIdleClueController({
    enabled: ctx.state.settings.provideClues && room.hintsAllowed,
    getTiles: () => room.racers[you].tiles,
    getTileElement: (id) => local.tileEls.get(id),
  });
}
