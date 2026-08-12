// Matched — Daily puzzle. One board, one attempt, resets on a 24h clock;
// the streak lives here. See docs/design-reference.html #1o.

import { el, avatarDot } from "./shared-ui.js";
import { dailyLayoutFor, dailySeedFor, todayDateStr, msUntilNextReset } from "../game/daily.js";
import { LAYOUTS } from "../game/layouts.js";
import { hashSeed } from "../game/mahjong.js";
import { buildLocalRoom } from "../game/room.js";

const GROUP = ["Dana", "Mika", "Jules", "Robin"];

// Deterministic, date-seeded "who's finished" demo data for the group list
// — same idea as the board's simulated opponents, so this screen never
// looks frozen when nobody else is actually connected yet.
function groupStatus(date) {
  return GROUP.map((name, i) => {
    const h = hashSeed(`${date}-${name}`);
    const finished = h % 3 !== 0;
    const seconds = 180 + (h % 240);
    return { name, finished, seconds, playing: !finished && h % 5 === 0 };
  });
}

export function renderDaily(root, ctx) {
  const date = todayDateStr();
  const layoutId = dailyLayoutFor(date);
  const layout = LAYOUTS[layoutId];
  const seed = dailySeedFor(date);
  const done = ctx.state.lastDailyCompleted === date;

  const header = el("div", { style: "padding:6px 20px 4px;display:flex;align-items:baseline;justify-content:space-between" });
  header.appendChild(el("div", { class: "title-serif", text: "Today" }));
  const ms = msUntilNextReset();
  header.appendChild(el("div", { style: "font:12.5px Figtree,sans-serif;color:rgba(246,241,228,.5)", text: `Resets in ${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m` }));
  root.appendChild(header);

  const boardCard = el("div", { style: "padding:14px 16px 0" });
  const card = el("div", { class: "gold-card" });
  const head = el("div", { style: "display:flex;justify-content:space-between;align-items:center" });
  head.appendChild(el("span", { style: "font:700 11px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e8c887", text: `Board ${seed % 900}` }));
  head.appendChild(el("span", { style: "padding:5px 11px;border-radius:999px;background:rgba(0,0,0,.28);font:700 12px Figtree,sans-serif;color:#f6f1e4", text: `🔥 ${ctx.state.dailyStreak} day streak` }));
  card.appendChild(head);
  card.appendChild(el("div", { class: "title-serif", style: "font-size:28px;margin:11px 0 6px", text: layout.name }));
  card.appendChild(el("div", { style: "font:13px Figtree,sans-serif;color:rgba(246,241,228,.6)", text: done ? "You already finished today's board." : "Everyone plays the same board. One attempt." }));
  const startBtn = el("button", { class: "btn btn-primary btn-lg", style: "width:100%;margin-top:16px", text: done ? "Already played" : `Start · ${layout.tileCount} tiles` });
  startBtn.disabled = done;
  startBtn.addEventListener("click", () => {
    if (done) return;
    const room = buildLocalRoom({
      title: layout.name, mode: "solo", layoutId, difficulty: layout.difficulty,
      visibility: "private", createdBy: ctx.state.currentUser, seed, isDaily: true,
    });
    ctx.state.store.rooms[room.id] = room;
    ctx.state.activeRoomId = room.id;
    ctx.persist();
    ctx.navigate("board", { roomId: room.id });
  });
  card.appendChild(startBtn);
  boardCard.appendChild(card);
  root.appendChild(boardCard);

  root.appendChild(el("div", { class: "section-label", style: "padding-top:22px", text: "Your group today" }));
  const list = el("div", { class: "row-list" });
  const rows = [
    { name: ctx.state.currentUser, me: true, finished: done, seconds: 0, playing: false },
    ...groupStatus(date),
  ];
  rows.forEach((r, i) => {
    const row = el("div", { style: `display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:13px;background:${r.me ? "rgba(217,164,65,.13)" : "rgba(255,255,255,.05)"}` });
    row.appendChild(avatarDot(r.name, i, 30));
    const info = el("div", { style: "flex:1;min-width:0" });
    info.appendChild(el("div", { style: `font:${r.me ? 700 : 500} 14px Figtree,sans-serif;color:#f6f1e4`, text: r.name }));
    info.appendChild(el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.45);margin-top:2px", text: r.playing ? "Playing now" : r.finished ? "Finished" : "Not played yet" }));
    row.appendChild(info);
    // Group times stay hidden until you finish today's board yourself.
    const canSeeTimes = done || r.me;
    const timeText = r.playing ? "live" : (r.finished && canSeeTimes) ? `${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, "0")}` : r.finished ? "Finished" : "—";
    row.appendChild(el("div", { style: `font:700 14px Figtree,sans-serif;color:${timeText === "live" ? "#5fbf9b" : timeText === "—" ? "rgba(246,241,228,.3)" : "#f6f1e4"}`, text: timeText }));
    list.appendChild(row);
  });
  root.appendChild(list);

  const note = el("div", { style: "margin:16px;padding:13px 15px;border-radius:14px;background:rgba(255,255,255,.05);font:12.5px/1.5 Figtree,sans-serif;color:rgba(246,241,228,.55)", text: "Times stay hidden until you finish, so nobody plays with a target in their head." });
  root.appendChild(note);
  root.appendChild(el("div", { style: "flex:1" }));
}
