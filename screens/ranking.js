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
    const botNames = new Set(room.botNames || []);
    for (const name of room.players) {
      if (botNames.has(name)) continue; // bots are session-only, never ranked
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

  const header = el("div", { style: "padding:6px 16px 14px;display:flex;align-items:baseline;justify-content:space-between" });
  header.appendChild(el("div", { class: "title-serif", style: "padding-left:4px", text: "Ranking" }));
  const periodDropdown = el("div", { style: "position:relative" });
  header.appendChild(periodDropdown);
  root.appendChild(header);

  const metricRow = el("div", { style: "padding:0 16px 14px;display:flex;gap:7px" });
  root.appendChild(metricRow);

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

  function renderMetricRow() {
    metricRow.innerHTML = "";
    METRICS.forEach((m) => {
      const chip = el("button", { class: `pill${m.id === metric ? " active" : ""}`, text: m.label });
      chip.addEventListener("click", () => {
        metric = m.id;
        renderMetricRow();
        renderList();
      });
      metricRow.appendChild(chip);
    });
  }

  // A small custom dropdown (not a native <select>, per the request to
  // avoid the OS-default look) — click the trigger to open a popover menu,
  // click a period or anywhere outside to close it.
  let periodOpen = false;
  function renderPeriodDropdown() {
    periodDropdown.innerHTML = "";
    const trigger = el("button", { style: "display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);font:600 12.5px Figtree,sans-serif;color:#f6f1e4;cursor:pointer" });
    trigger.appendChild(el("span", { text: period }));
    trigger.appendChild(el("span", { style: `font-size:10px;color:rgba(246,241,228,.5);display:inline-block;transition:transform .15s;transform:rotate(${periodOpen ? 180 : 0}deg)`, text: "▾" }));
    trigger.addEventListener("click", (e) => { e.stopPropagation(); periodOpen = !periodOpen; renderPeriodDropdown(); });
    periodDropdown.appendChild(trigger);
    if (periodOpen) {
      const menu = el("div", { style: "position:absolute;top:calc(100% + 6px);right:0;min-width:132px;padding:6px;border-radius:12px;background:#183226;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 24px rgba(0,0,0,.4);z-index:40;display:flex;flex-direction:column;gap:2px" });
      PERIODS.forEach((p) => {
        const isActive = p === period;
        const item = el("button", { style: `text-align:left;padding:8px 10px;border-radius:8px;border:none;cursor:pointer;background:${isActive ? "rgba(217,164,65,.18)" : "none"};color:${isActive ? "#e8c887" : "#f6f1e4"};font:${isActive ? 700 : 600} 13px Figtree,sans-serif`, text: p });
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          period = p;
          periodOpen = false;
          renderPeriodDropdown();
          renderList();
        });
        menu.appendChild(item);
      });
      periodDropdown.appendChild(menu);
    }
  }
  const closeDropdownOnOutsideClick = () => { if (periodOpen) { periodOpen = false; renderPeriodDropdown(); } };
  document.addEventListener("click", closeDropdownOnOutsideClick);
  window.__matchedCleanup = () => document.removeEventListener("click", closeDropdownOnOutsideClick);

  renderPeriodDropdown();
  renderMetricRow();
  renderList();
  root.appendChild(el("div", { style: "flex:1" }));
}
