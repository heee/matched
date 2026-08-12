// Matched — Ranking. Time filters, one metric at a time behind a Change
// control, gold highlight for the current user. See design-reference #1k.

import { el, avatarDot } from "./shared-ui.js";
import { PLAYER_COLORS } from "../game/scoring.js";

const PERIODS = ["Today", "Week", "Month", "All time"];
const METRICS = [
  { id: "pairs", label: "Pairs cleared" },
  { id: "speed", label: "Speed to clear" },
  { id: "share", label: "Board completion share" },
];

function periodStartMs(period) {
  const now = Date.now();
  if (period === "Today") return now - 24 * 3600 * 1000;
  if (period === "Week") return now - 7 * 24 * 3600 * 1000;
  if (period === "Month") return now - 30 * 24 * 3600 * 1000;
  return 0;
}

function aggregate(rooms, period) {
  const since = periodStartMs(period);
  const byPlayer = new Map();
  for (const room of Object.values(rooms)) {
    if (!room.completedAt) continue;
    if (Date.parse(room.completedAt) < since) continue;
    const totalPairs = room.tileCount / 2;
    const elapsedS = room.startedAt ? Math.max(1, Math.round((Date.parse(room.completedAt) - room.startedAt) / 1000)) : null;
    for (const name of room.players) {
      if (!byPlayer.has(name)) byPlayer.set(name, { name, boards: 0, pairs: 0, timeS: 0, share: 0 });
      const agg = byPlayer.get(name);
      agg.boards += 1;
      agg.pairs += room.pairsCleared[name] || 0;
      if (elapsedS) agg.timeS += elapsedS;
      agg.share += totalPairs > 0 ? ((room.pairsCleared[name] || 0) / totalPairs) * 100 : 0;
    }
  }
  return [...byPlayer.values()];
}

function metricValue(row, metric) {
  if (metric === "pairs") return row.pairs;
  if (metric === "speed") return row.boards ? Math.round(row.timeS / row.boards) : 0;
  if (metric === "share") return row.boards ? Math.round(row.share / row.boards) : 0;
  return 0;
}

function formatMetric(value, metric) {
  if (metric === "speed") { const m = Math.floor(value / 60); const s = value % 60; return `${m}:${String(s).padStart(2, "0")}`; }
  if (metric === "share") return `${value}%`;
  return String(value);
}

export function renderRanking(root, ctx) {
  let period = "Week";
  let metric = "pairs";
  const players = ["You_placeholder"]; // replaced below

  root.appendChild(el("div", { class: "title-serif", style: "padding:6px 20px 12px", text: "Ranking" }));

  const periodRow = el("div", { style: "padding:0 16px 14px;display:flex;gap:7px" });
  root.appendChild(periodRow);

  const metricCard = el("div", { style: "margin:0 16px 14px;padding:13px 15px;border-radius:14px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between" });
  root.appendChild(metricCard);

  const list = el("div", { class: "row-list" });
  root.appendChild(list);

  function renderList() {
    list.innerHTML = "";
    const rows = aggregate(ctx.state.store.rooms || {}, period)
      .map((r) => ({ ...r, value: metricValue(r, metric) }))
      .sort((a, b) => metric === "speed" ? (a.value || Infinity) - (b.value || Infinity) : b.value - a.value);

    if (rows.length === 0) {
      list.appendChild(el("div", { class: "empty-note", style: "padding:8px 4px", text: "No completed boards in this window yet — finish one to show up here." }));
      return;
    }

    rows.forEach((r, i) => {
      const isMe = r.name === ctx.state.currentUser;
      const row = el("div", {
        style: `display:flex;align-items:center;gap:11px;padding:12px 13px;border-radius:14px;background:${isMe ? "rgba(217,164,65,.14)" : "rgba(255,255,255,.06)"};border:1px solid ${isMe ? "rgba(217,164,65,.35)" : "rgba(255,255,255,.07)"}`,
      });
      row.appendChild(el("div", { style: `width:22px;font:700 15px Figtree,sans-serif;color:${i === 0 ? "#d9a441" : "rgba(246,241,228,.4)"}`, text: String(i + 1) }));
      row.appendChild(avatarDot(r.name, i, 34));
      const info = el("div", { style: "flex:1;min-width:0" });
      info.appendChild(el("div", { style: `font:${isMe ? 700 : 500} 15px Figtree,sans-serif;color:#f6f1e4`, text: r.name }));
      info.appendChild(el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.45);margin-top:2px", text: `${r.boards} board${r.boards === 1 ? "" : "s"} · ${metric === "speed" ? `${formatMetric(Math.round(r.timeS / r.boards), "speed")} avg` : `${r.pairs} pairs`}` }));
      row.appendChild(info);
      row.appendChild(el("div", { style: "font:700 17px Figtree,sans-serif;color:#f6f1e4", text: formatMetric(r.value, metric) }));
      list.appendChild(row);
    });
  }

  function renderMetricCard() {
    metricCard.innerHTML = "";
    const label = el("div");
    label.appendChild(el("div", { style: "font:700 10px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(246,241,228,.45)", text: "Ranking by" }));
    label.appendChild(el("div", { style: "font:600 15px Figtree,sans-serif;color:#f6f1e4;margin-top:2px", text: METRICS.find((m) => m.id === metric).label }));
    metricCard.appendChild(label);
    const changeBtn = el("button", { style: "padding:7px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:none;font:600 12.5px Figtree,sans-serif;color:#e8c887;cursor:pointer", text: "Change" });
    changeBtn.addEventListener("click", () => {
      const idx = METRICS.findIndex((m) => m.id === metric);
      metric = METRICS[(idx + 1) % METRICS.length].id;
      renderMetricCard();
      renderList();
    });
    metricCard.appendChild(changeBtn);
  }

  PERIODS.forEach((p) => {
    const chip = el("button", { class: `pill${p === period ? " active" : ""}`, text: p });
    chip.addEventListener("click", () => {
      period = p;
      [...periodRow.children].forEach((c) => c.classList.toggle("active", c.textContent === p));
      renderList();
    });
    periodRow.appendChild(chip);
  });

  renderMetricCard();
  renderList();
  root.appendChild(el("div", { style: "flex:1" }));
}
