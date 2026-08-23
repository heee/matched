// Matched — Results. Real 1-4 ranking, "worth mentioning" highlights,
// points + tier progress, Share/Rematch/Done. See design-reference #1m.

import { el, avatarDot, formatDuration, roomInviteUrl } from "./shared-ui.js";
import { PLAYER_COLORS, highlightsFromLog, pointsToNextTier, nextTier, tierForPoints } from "../game/scoring.js";
import { buildLocalRoom } from "../game/room.js?v=3";
import { resultShareMessage } from "../game/share-messages.js";
import { elapsedMsSince } from "../game/time.js";

// Stroke-only action icons for the Board Cleared action row, same Lucide
// convention as the board's control-row icons (currentColor, no fill).
const ICON_SHARE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
const ICON_REMATCH = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
const ICON_DONE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-4-4"/></svg>`;

export function renderResults(root, ctx, params = {}) {
  const room = ctx.state.store.rooms[params.roomId];
  if (!room) { ctx.navigate("home"); return; }
  const lastResult = ctx.state.lastResult && ctx.state.lastResult.roomId === room.id ? ctx.state.lastResult : null;

  root.classList.add("bg-felt");
  root.style.paddingTop = "70px";
  root.style.textAlign = "center";

  const top = el("div", { style: "padding:0 24px" });
  top.appendChild(el("div", { style: "font:700 11px Figtree,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e8c887", text: "Board cleared" }));
  top.appendChild(el("div", { class: "title-serif", style: "font-size:38px;margin-top:8px", text: room.title }));
  const elapsedS = Math.floor((lastResult?.elapsedMs ?? elapsedMsSince(room.startedAt, Date.now()) ?? 0) / 1000);
  top.appendChild(el("div", { style: "font:14px Figtree,sans-serif;color:rgba(246,241,228,.6);margin-top:8px", text: `${formatDuration(elapsedS)} · ${room.players.length} players · ${room.tileCount} tiles` }));
  root.appendChild(top);

  const results = room.players
    .map((name, i) => ({ name, pairs: room.pairsCleared[name] || 0, seat: i }))
    .sort((a, b) => b.pairs - a.pairs);
  const maxPairs = Math.max(1, ...results.map((r) => r.pairs));

  const rankCard = el("div", { style: "margin:22px 16px 0;padding:16px;border-radius:18px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:12px" });
  results.forEach((r, i) => {
    const row = el("div", { style: "display:flex;align-items:center;gap:12px;text-align:left" });
    row.appendChild(el("div", { style: `width:22px;font:700 15px Figtree,sans-serif;color:${i === 0 ? "#d9a441" : "rgba(246,241,228,.4)"}`, text: String(i + 1) }));
    row.appendChild(avatarDot(r.name, r.seat, 32));
    const info = el("div", { style: "flex:1;min-width:0" });
    info.appendChild(el("div", { style: `font:${r.name === ctx.state.currentUser ? 700 : 500} 14.5px Figtree,sans-serif;color:#f6f1e4`, text: r.name === ctx.state.currentUser ? "You" : r.name }));
    info.appendChild(el("div", { class: "progress-thin", style: "margin-top:6px;height:6px", html: `<div style="width:${Math.round((r.pairs / maxPairs) * 100)}%;background:${PLAYER_COLORS[r.seat % PLAYER_COLORS.length]}"></div>` }));
    row.appendChild(info);
    const right = el("div", { style: "text-align:right" });
    right.appendChild(el("div", { style: "font:700 16px Figtree,sans-serif;color:#f6f1e4", text: String(r.pairs) }));
    right.appendChild(el("div", { style: "font:10px Figtree,sans-serif;color:rgba(246,241,228,.45)", text: "pairs" }));
    row.appendChild(right);
    rankCard.appendChild(row);
  });
  root.appendChild(rankCard);

  const highlights = lastResult?.highlights?.length
    ? lastResult.highlights
    : highlightsFromLog(room.state.matchLog || [], Object.fromEntries(room.players.map((p, i) => [i, { name: p }])));
  const worthCard = el("div", { style: "margin:14px 16px 0;padding:15px;border-radius:16px;background:rgba(255,255,255,.06);display:flex;flex-direction:column;gap:9px;text-align:left" });
  worthCard.appendChild(el("div", { style: "font:700 10px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(246,241,228,.45)", text: "Worth mentioning" }));
  if (highlights.length === 0) worthCard.appendChild(el("div", { style: "font:13.5px/1.45 Figtree,sans-serif;color:rgba(246,241,228,.6)", text: "A clean, quiet board — nothing dramatic happened." }));
  highlights.forEach((line) => worthCard.appendChild(el("div", { style: "font:13.5px/1.45 Figtree,sans-serif;color:rgba(246,241,228,.85)", text: line })));
  root.appendChild(worthCard);

  const earned = lastResult?.earned ?? 0;
  const toNext = pointsToNextTier(ctx.state.points);
  const next = nextTier(ctx.state.points);
  const pointsCard = el("div", { style: "margin:14px 16px 0;padding:13px 15px;border-radius:14px;background:rgba(217,164,65,.14);border:1px solid rgba(217,164,65,.35);display:flex;align-items:center;gap:12px" });
  pointsCard.appendChild(el("div", { style: "font-size:20px", text: "✦" }));
  pointsCard.appendChild(el("div", { style: "font:13px/1.4 Figtree,sans-serif;color:#f2e6cc", text: `+${earned} points${next ? ` · ${toNext.toLocaleString()} to ${next.name}` : " · Dragon tier reached"}` }));
  root.appendChild(pointsCard);

  root.appendChild(el("div", { style: "flex:1" }));

  const actions = el("div", { style: "display:flex;gap:9px;padding:0 16px 30px" });
  const shareBtn = el("button", { class: "btn btn-ghost", style: "flex:1;height:50px;border-radius:14px;gap:7px", html: `${ICON_SHARE}<span>Share</span>` });
  shareBtn.addEventListener("click", async () => {
    const me = results.find((result) => result.name === ctx.state.currentUser);
    const rank = Math.max(1, results.findIndex((result) => result.name === ctx.state.currentUser) + 1);
    const message = resultShareMessage({
      title: room.title,
      elapsed: formatDuration(elapsedS),
      pairs: me?.pairs || 0,
      rank,
      playerCount: results.length,
    });
    const url = roomInviteUrl(room.id);
    const shareData = { title: room.title, text: message, url };
    if (navigator.share) { try { await navigator.share(shareData); } catch (e) {} }
    else { navigator.clipboard?.writeText(`${message} ${url}`).catch(() => {}); ctx.toast("Result copied"); }
  });
  const replayLabel = room.mode === "solo" ? "Replay" : "Rematch";
  const rematchBtn = el("button", { class: "btn btn-ghost", style: "flex:1;height:50px;border-radius:14px;gap:7px", html: `${ICON_REMATCH}<span>${replayLabel}</span>` });
  rematchBtn.addEventListener("click", () => {
    const fresh = buildLocalRoom({
      title: room.title, mode: room.mode, layoutId: room.layoutId, difficulty: room.difficulty,
      visibility: room.visibility, createdBy: ctx.state.currentUser, freeTilesGlow: room.freeTilesGlow, hintsAllowed: room.hintsAllowed,
    });
    ctx.state.store.rooms[fresh.id] = fresh;
    ctx.state.activeRoomId = fresh.id;
    ctx.persist();
    ctx.navigate(fresh.mode === "race" ? "race-board" : "board", { roomId: fresh.id });
  });
  const doneBtn = el("button", { class: "btn btn-primary", style: "flex:1;height:50px;border-radius:14px;gap:7px", html: `${ICON_DONE}<span>Done</span>` });
  doneBtn.addEventListener("click", () => ctx.navigate("home"));
  actions.appendChild(shareBtn);
  actions.appendChild(rematchBtn);
  actions.appendChild(doneBtn);
  root.appendChild(actions);
}
