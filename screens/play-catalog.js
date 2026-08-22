// Matched — Play: layout catalog. Curated, not generated. See
// docs/design-reference.html #1j and the layout-level design extension.

import { el, isTabletViewport } from "./shared-ui.js";
import { LAYOUTS, layoutSilhouette, isLayoutUnlocked } from "../game/layouts.js";
import { completedLayoutStats } from "../game/layout-stats.js";
import { layoutLevelProgress } from "../game/layout-levels.js";

const FILTERS = ["All difficulties", "Easy", "Medium", "Hard"];

function blockPattern(layout) {
  return layoutSilhouette(layout, 9, 5).map((p) => ({
    left: 12 + (p.xPct / 100) * 76,
    top: 15 + (p.yPct / 100) * 70,
    z: p.z,
  }));
}

function levelBadge(completedGames, { locked = false } = {}) {
  if (locked) {
    return el("div", {
      "aria-label": "Locked",
      style: "width:50px;height:50px;flex:none;border-radius:50%;border:3px solid rgba(246,241,228,.09);display:flex;align-items:center;justify-content:center;font:700 20px Figtree,sans-serif;color:rgba(246,241,228,.16)",
      text: "—",
    });
  }

  if (completedGames === 0) {
    return el("div", {
      "aria-label": "Never completed",
      style: "width:50px;height:50px;flex:none;border-radius:50%;border:1.5px dashed rgba(246,241,228,.34);display:flex;align-items:center;justify-content:center;font:700 10px Figtree,sans-serif;letter-spacing:.08em;color:rgba(246,241,228,.6)",
      text: "NEW",
    });
  }

  const { level, progress, remaining } = layoutLevelProgress(completedGames);
  const sweep = Math.round(progress * 360);
  const levelLabel = remaining === 0
    ? `Level ${level}, maximum level reached`
    : `Level ${level}, ${remaining} completed game${remaining === 1 ? "" : "s"} to next level`;
  const badge = el("div", {
    "aria-label": levelLabel,
    style: `width:50px;height:50px;flex:none;border-radius:50%;padding:3px;background:conic-gradient(from -90deg,#d9a441 0deg ${sweep}deg,rgba(246,241,228,.13) ${sweep}deg 360deg)`,
  });
  const inner = el("div", { style: "width:100%;height:100%;border-radius:50%;background:#173c2d;display:flex;flex-direction:column;align-items:center;justify-content:center" });
  inner.appendChild(el("div", { style: "font:700 8px/1 Figtree,sans-serif;letter-spacing:.12em;color:rgba(246,241,228,.52)", text: "LV" }));
  inner.appendChild(el("div", { style: "font:700 21px/1 Figtree,sans-serif;color:#f6f1e4;margin-top:2px", text: String(level) }));
  badge.appendChild(inner);
  return badge;
}

function layoutCard(ctx, layout, stats) {
  const unlocked = isLayoutUnlocked(layout, ctx.state.points);
  const card = el("button", {
    type: "button",
    style: `width:100%;padding:0;text-align:left;display:flex;align-items:stretch;min-height:88px;border-radius:15px;overflow:hidden;background:rgba(255,255,255,.06);border:1px solid ${unlocked ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.07)"};${unlocked ? "cursor:pointer" : "opacity:.62;cursor:default"}`,
  });

  const thumb = el("div", { style: "width:102px;flex:none;position:relative;background:radial-gradient(120% 120% at 50% 30%,#1d6349,#0e3527)" });
  blockPattern(layout).forEach(({ left, top, z }) => {
    thumb.appendChild(el("div", {
      style: `position:absolute;left:${left}%;top:${top}%;width:9px;height:12px;margin:-6px 0 0 -4.5px;border-radius:2px;background:#f2ecdc;box-shadow:1px 1px 0 rgba(0,0,0,.32);z-index:${z}`,
    }));
  });
  if (!unlocked) {
    thumb.appendChild(el("div", { style: "position:absolute;inset:0;background:rgba(8,26,20,.72);display:flex;align-items:center;justify-content:center;font-size:19px", text: "🔒" }));
  }
  card.appendChild(thumb);

  const body = el("div", { style: "padding:13px 12px 13px 16px;flex:1;min-width:0;display:flex;align-items:center;gap:10px" });
  const copy = el("div", { style: "flex:1;min-width:0" });
  copy.appendChild(el("div", { style: `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 16px Figtree,sans-serif;color:${unlocked ? "#f6f1e4" : "rgba(246,241,228,.55)"}`, text: layout.name }));
  const difficulty = layout.difficulty[0].toUpperCase() + layout.difficulty.slice(1);
  copy.appendChild(el("div", {
    style: `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px Figtree,sans-serif;color:${unlocked ? "rgba(246,241,228,.52)" : "rgba(224,138,106,.7)"};margin-top:4px`,
    text: `${layout.tileCount} tiles · ${unlocked ? difficulty : layout.tier}`,
  }));
  body.appendChild(copy);
  body.appendChild(levelBadge(stats.boards, { locked: !unlocked }));
  card.appendChild(body);

  card.addEventListener("click", () => {
    if (!unlocked) {
      ctx.toast(`${layout.name} unlocks at ${layout.tier} tier.`);
      return;
    }
    ctx.navigate("room-setup", { layoutId: layout.id });
  });
  return card;
}

export function renderPlayCatalog(root, ctx) {
  let filter = FILTERS[0];
  const layoutStats = completedLayoutStats(ctx.state.store.rooms, ctx.state.currentUser);

  const header = el("div", { style: "padding:8px 20px 16px;display:flex;align-items:center;justify-content:space-between;gap:14px" });
  header.appendChild(el("div", { class: "title-serif", text: "Play" }));
  const selectWrap = el("div", { style: "position:relative;flex:none" });
  const select = el("select", {
    "aria-label": "Filter layouts by difficulty",
    style: "appearance:none;-webkit-appearance:none;height:40px;max-width:150px;padding:0 35px 0 14px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);font:600 13px Figtree,sans-serif;color:#f6f1e4;cursor:pointer",
  });
  FILTERS.forEach((name) => select.appendChild(el("option", { value: name, text: name, style: "background:#173c2d;color:#f6f1e4" })));
  selectWrap.appendChild(select);
  selectWrap.appendChild(el("span", { style: "position:absolute;right:14px;top:50%;transform:translateY(-52%);font:700 10px Figtree,sans-serif;color:rgba(246,241,228,.65);pointer-events:none", text: "▾" }));
  header.appendChild(selectWrap);
  root.appendChild(header);

  const grid = el("div", { class: "catalog-list", style: "padding:0 16px" });
  function renderGrid() {
    grid.innerHTML = "";
    Object.values(LAYOUTS)
      .filter((layout) => !layout.tabletOnly || isTabletViewport())
      .filter((layout) => filter === FILTERS[0] || layout.difficulty === filter.toLowerCase())
      .forEach((layout) => grid.appendChild(layoutCard(ctx, layout, layoutStats[layout.id] || { boards: 0, pairs: 0 })));
  }
  select.addEventListener("change", () => {
    filter = select.value;
    renderGrid();
  });
  root.appendChild(grid);
  renderGrid();
  root.appendChild(el("div", { style: "flex:1" }));
}
