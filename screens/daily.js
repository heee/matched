// Matched — Daily puzzle. One board, one attempt, resets on a 24h clock;
// the streak lives here. See docs/design-reference.html #1o.

import { el, avatarDot } from "./shared-ui.js";
import { dailyLayoutFor, dailySeedFor, todayDateStr, msUntilNextReset } from "../game/daily.js";
import { LAYOUTS } from "../game/layouts.js";
import { buildLocalRoom } from "../game/room.js?v=3";

export function renderDaily(root, ctx) {
  const date = todayDateStr();
  const layoutId = dailyLayoutFor(date);
  const layout = LAYOUTS[layoutId];
  const seed = dailySeedFor(date);
  const done = ctx.state.dailyCompletedByUser?.[ctx.state.currentUser] === date;

  const header = el("div", { style: "padding:6px 20px 4px;display:flex;align-items:baseline;justify-content:space-between" });
  header.appendChild(el("div", { class: "title-serif", text: "Today" }));
  const ms = msUntilNextReset();
  header.appendChild(el("div", { style: "font:12.5px Figtree,sans-serif;color:rgba(246,241,228,.5)", text: `Resets in ${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m` }));
  root.appendChild(header);

  const boardCard = el("div", { style: "padding:14px 16px 0" });
  const card = el("div", { class: "gold-card" });
  const head = el("div", { style: "display:flex;justify-content:space-between;align-items:center" });
  head.appendChild(el("span", { style: "font:700 11px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e8c887", text: `Board ${seed % 900}` }));
  const streak = ctx.state.dailyStreaks?.[ctx.state.currentUser] || 0;
  head.appendChild(el("span", { style: "padding:5px 11px;border-radius:999px;background:rgba(0,0,0,.28);font:700 12px Figtree,sans-serif;color:#f6f1e4", text: `🔥 ${streak} day streak` }));
  card.appendChild(head);
  card.appendChild(el("div", { class: "title-serif", style: "font-size:28px;margin:11px 0 6px", text: layout.name }));
  card.appendChild(el("div", { style: "font:13px Figtree,sans-serif;color:rgba(246,241,228,.6)", text: done ? "You already finished today's board." : "Everyone plays the same board. One attempt." }));
  if (!done) {
    const startBtn = el("button", { class: "btn btn-primary btn-lg", style: "width:100%;margin-top:16px", text: `Start · ${layout.tileCount} tiles` });
    startBtn.addEventListener("click", () => {
      const room = buildLocalRoom({
        title: layout.name, mode: "solo", layoutId, difficulty: layout.difficulty,
        visibility: "private", createdBy: ctx.state.currentUser, seed, isDaily: true,
      });
      room.dailyDate = date;
      ctx.state.store.rooms[room.id] = room;
      ctx.state.activeRoomId = room.id;
      ctx.persist();
      ctx.navigate("board", { roomId: room.id });
    });
    card.appendChild(startBtn);
  }
  boardCard.appendChild(card);
  root.appendChild(boardCard);

  root.appendChild(el("div", { class: "section-label", style: "padding-top:22px", text: "Today's results" }));
  const list = el("div", { class: "row-list" });
  root.appendChild(list);

  function renderResults(results) {
    list.innerHTML = "";
    if (!results.length) {
      list.appendChild(el("div", { class: "empty-note", style: "padding:0 4px", text: "No registered players have finished today's board yet." }));
      return;
    }
    results.forEach((result, i) => {
      const me = result.name === ctx.state.currentUser;
      const row = el("div", { style: `display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:13px;background:${me ? "rgba(217,164,65,.13)" : "rgba(255,255,255,.05)"}` });
      row.appendChild(el("div", { style: `width:18px;font:700 13px Figtree,sans-serif;color:${i === 0 ? "#d9a441" : "rgba(246,241,228,.35)"}`, text: String(i + 1) }));
      row.appendChild(avatarDot(result.name, i, 30));
      const info = el("div", { style: "flex:1;min-width:0" });
      info.appendChild(el("div", { style: `font:${me ? 700 : 500} 14px Figtree,sans-serif;color:#f6f1e4`, text: me ? "You" : result.name }));
      info.appendChild(el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.45);margin-top:2px", text: `${result.pairsMatched} pairs matched` }));
      row.appendChild(info);
      const seconds = Math.max(0, Math.round(Number(result.elapsedMs) / 1000));
      row.appendChild(el("div", { style: "font:700 14px Figtree,sans-serif;color:#f6f1e4", text: done ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Finished" }));
      list.appendChild(row);
    });
  }

  const localByName = new Map();
  const savedResult = ctx.state.dailyResults?.[`${date}:${ctx.state.currentUser}`];
  if (savedResult) {
    localByName.set(ctx.state.currentUser, { name: ctx.state.currentUser, elapsedMs: savedResult.elapsedMs, pairsMatched: savedResult.pairsMatched });
  }
  Object.values(ctx.state.store.rooms || {})
    .filter((room) => room.isDaily && (room.dailyDate === date || (!room.dailyDate && room.completedAt?.slice(0, 10) === date)) && room.createdBy === ctx.state.currentUser)
    .forEach((room) => localByName.set(ctx.state.currentUser, { name: ctx.state.currentUser, elapsedMs: room.elapsedMs || 0, pairsMatched: Number(room.pairsCleared?.[ctx.state.currentUser]) || 0 }));
  const localResults = [...localByName.values()];
  renderResults(localResults);
  if (ctx.api.configured()) {
    ctx.api.fetchDaily().then((daily) => {
      if (daily.date !== date) return;
      const merged = new Map((daily.results || []).map((result) => [result.name, result]));
      localResults.forEach((result) => { if (!merged.has(result.name)) merged.set(result.name, result); });
      renderResults([...merged.values()].sort((a, b) => Number(a.elapsedMs) - Number(b.elapsedMs)));
    }).catch(() => {});
  }

  const note = el("div", { style: "margin:16px;padding:13px 15px;border-radius:14px;background:rgba(255,255,255,.05);font:12.5px/1.5 Figtree,sans-serif;color:rgba(246,241,228,.55)", text: "Times stay hidden until you finish, so nobody plays with a target in their head." });
  root.appendChild(note);
  root.appendChild(el("div", { style: "flex:1" }));
}
