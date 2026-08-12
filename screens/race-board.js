// Matched — Race board. Same layout, separate boards; night-slate felt;
// live progress bars ordered by position; standings surface in a bottom
// strip instead of a toast; no tray. See docs/design-reference.html #1h.

import { el, avatarDot, renderTileFace, formatClock } from "./shared-ui.js";
import { freeTiles, findHintPair, clearPair, hasMovesRemaining } from "../game/mahjong.js";
import { TILE_W, TILE_H, STEP_X, STEP_Y, LAYER_OFFSET } from "../game/layouts.js";
import { PLAYER_COLORS } from "../game/scoring.js";

const BOT_INTERVAL_MS = 4200;

export function renderRaceBoard(root, ctx, params = {}) {
  const room = ctx.state.store.rooms[params.roomId];
  if (!room || !room.racers) { ctx.navigate("home"); return; }
  ctx.state.activeRoomId = room.id;
  const you = ctx.state.currentUser;
  const totalPairs = room.tileCount / 2;

  const local = { selectedId: null, lastStandingLeader: null, tileEls: new Map() };
  root.classList.add("bg-slate");

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

  const boardArea = el("div", { style: "flex:1;display:flex;align-items:center;justify-content:center;position:relative" });
  const boardViewport = el("div", { style: "position:relative;width:100%;height:220px;display:flex;align-items:center;justify-content:center" });
  const boardWrap = el("div", { style: "position:relative" });
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

  function tilePixelBox(tiles) {
    let maxX = 0, maxY = 0, maxZ = 0;
    for (const t of tiles) { maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y); maxZ = Math.max(maxZ, t.z); }
    return { width: (maxX + 1) * STEP_X + TILE_W + maxZ * LAYER_OFFSET, height: (maxY + 1) * STEP_Y + TILE_H + maxZ * LAYER_OFFSET, padTop: maxZ * LAYER_OFFSET };
  }

  // Full rebuild — only for actual tile changes (clear, initial load). See
  // board.js's renderBoardTiles for why selection alone must not hit this:
  // recreating every node replays each tile's popIn entrance at once
  // (looks like the board "vibrating") and can't transition .selected.
  function renderMyBoard() {
    const mine = room.racers[you];
    const tiles = mine.tiles;
    const free = new Set(freeTiles(tiles).map((t) => t.id));
    const box = tilePixelBox(tiles);
    boardWrap.style.width = `${box.width}px`;
    boardWrap.style.height = `${box.height}px`;
    const scale = Math.min(1, (boardArea.clientWidth - 24) / box.width, 210 / box.height);
    boardWrap.style.transform = `scale(${scale})`;
    boardWrap.innerHTML = "";
    local.tileEls = new Map();
    for (const t of tiles) {
      const isF = free.has(t.id);
      const px = t.x * STEP_X + t.z * LAYER_OFFSET;
      const py = t.y * STEP_Y - t.z * LAYER_OFFSET + box.padTop;
      const cls = ["tile"];
      if (t.z > 0) cls.push("upper");
      if (!isF) cls.push("blocked");
      const tileEl = el("div", { class: cls.join(" "), style: `left:${px}px;top:${py}px;width:${TILE_W}px;height:${TILE_H}px;z-index:${t.z * 100 + t.y}` });
      const face = el("div", { class: "tile-face" });
      renderTileFace(face, t.face);
      tileEl.appendChild(face);
      tileEl.addEventListener("click", () => tap(t.id));
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
      mine.tiles = result.tiles;
      room.pairsCleared[you] = (room.pairsCleared[you] || 0) + 1;
      local.selectedId = null;
      ctx.persist();
      renderRacers();
      renderMyBoard();
      if (mine.tiles.length === 0) finishRace();
    } else {
      shakeMismatch(firstId, id);
    }
  }

  function finishRace() {
    stopBots();
    room.completedAt = room.completedAt || new Date().toISOString();
    ctx.state.activeRoomId = null;
    ctx.persist();
    ctx.navigate("results", { roomId: room.id });
  }

  let botTimer = setInterval(() => {
    const bots = room.players.filter((p) => p !== you);
    for (const bot of bots) {
      const racer = room.racers[bot];
      if (!racer || racer.tiles.length === 0) continue;
      const pair = findHintPair(racer.tiles);
      if (!pair) continue;
      if (Math.random() > 0.6) continue; // don't clear on every tick, keeps it a real race
      const result = clearPair(racer.tiles, pair[0], pair[1]);
      if (result) {
        racer.tiles = result.tiles;
        room.pairsCleared[bot] = (room.pairsCleared[bot] || 0) + 1;
      }
    }
    renderRacers();
  }, BOT_INTERVAL_MS);

  function stopBots() { clearInterval(botTimer); botTimer = null; }
  window.__matchedCleanup = stopBots;

  renderRacers();
  renderMyBoard();
}
