// Matched — Play: layout catalog. Curated, not generated. See
// docs/design-reference.html #1j and the layout-level design extension.

import { el, isTabletViewport, renderTileFace, formatClock } from "./shared-ui.js";
import { LAYOUTS, layoutSilhouette, isLayoutUnlocked, TILE_W, TILE_H } from "../game/layouts.js";
import { layoutThemeFaces } from "../game/tiles.js";
import { completedLayoutStats, layoutRecordStats } from "../game/layout-stats.js";
import { layoutLevelProgress } from "../game/layout-levels.js";

const FILTERS = ["All difficulties", "Easy", "Medium", "Hard"];

// A thumbnail built from real tile faces (themed to the layout — dragons,
// winds, character glyphs, ...) rather than flat cream dabs, arranged onto
// the layout's actual footprint (layoutSilhouette) so its shape still
// reads. Tiles are rendered at native 40x52 size and scaled down via CSS
// transform, so they reuse the exact same face art the board itself uses.
const THUMB_TILE_SCALE = 0.26;

function thumbTile(face, leftPx, topPx, z) {
  const wrap = el("div", {
    style: `position:absolute;left:${leftPx}px;top:${topPx}px;width:${TILE_W}px;height:${TILE_H}px;transform:scale(${THUMB_TILE_SCALE});transform-origin:top left;z-index:${z}`,
  });
  const tileEl = el("div", { class: `tile${z > 0 ? " upper" : ""}`, style: "position:static" });
  const face_ = el("div", { class: "tile-face" });
  renderTileFace(face_, face, null);
  tileEl.appendChild(face_);
  wrap.appendChild(tileEl);
  return wrap;
}

function layoutThumb(layout, unlocked) {
  const thumbW = 58, thumbH = 46;
  const box = el("div", {
    style: `width:${thumbW}px;height:${thumbH}px;position:relative;border-radius:10px;overflow:hidden;background:radial-gradient(120% 120% at 50% 25%,#1d6349,#0e3527)`,
  });
  const miniW = TILE_W * THUMB_TILE_SCALE, miniH = TILE_H * THUMB_TILE_SCALE;
  const faces = layoutThemeFaces(layout);
  const cells = layoutSilhouette(layout, 8, 5).sort((a, b) => a.z - b.z || a.yPct - b.yPct || a.xPct - b.xPct);
  cells.forEach((cell, i) => {
    const cxPct = 8 + (cell.xPct / 100) * 84;
    const cyPct = 10 + (cell.yPct / 100) * 80;
    const leftPx = (cxPct / 100) * thumbW - miniW / 2 + cell.z * 1.4;
    const topPx = (cyPct / 100) * thumbH - miniH / 2 - cell.z * 1.4;
    const face = faces[Math.floor(i / 2) % faces.length];
    box.appendChild(thumbTile(face, leftPx, topPx, cell.z * 10 + i));
  });
  if (!unlocked) {
    box.appendChild(el("div", { style: "position:absolute;inset:0;background:rgba(8,26,20,.72);display:flex;align-items:center;justify-content:center;font-size:16px;z-index:999", text: "🔒" }));
  }
  return box;
}

function levelBadge(completedGames, { locked = false, size = 42 } = {}) {
  const lvFont = Math.round(size * 0.16);
  const numFont = Math.round(size * 0.42);
  if (locked) {
    return el("div", {
      "aria-label": "Locked",
      style: `width:${size}px;height:${size}px;flex:none;border-radius:50%;border:3px solid rgba(246,241,228,.09);display:flex;align-items:center;justify-content:center;font:700 ${Math.round(size * 0.38)}px Figtree,sans-serif;color:rgba(246,241,228,.16)`,
      text: "—",
    });
  }

  if (completedGames === 0) {
    return el("div", {
      "aria-label": "Never completed",
      style: `width:${size}px;height:${size}px;flex:none;border-radius:50%;border:1.5px dashed rgba(246,241,228,.34);display:flex;align-items:center;justify-content:center;font:700 ${Math.max(8, Math.round(size * 0.2))}px Figtree,sans-serif;letter-spacing:.06em;color:rgba(246,241,228,.6)`,
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
    style: `width:${size}px;height:${size}px;flex:none;border-radius:50%;padding:2.5px;background:conic-gradient(from -90deg,#d9a441 0deg ${sweep}deg,rgba(246,241,228,.13) ${sweep}deg 360deg)`,
  });
  const inner = el("div", { style: "width:100%;height:100%;border-radius:50%;background:#173c2d;display:flex;flex-direction:column;align-items:center;justify-content:center" });
  inner.appendChild(el("div", { style: `font:700 ${lvFont}px/1 Figtree,sans-serif;letter-spacing:.1em;color:rgba(246,241,228,.52)`, text: "LV" }));
  inner.appendChild(el("div", { style: `font:700 ${numFont}px/1 Figtree,sans-serif;color:#f6f1e4;margin-top:1px`, text: String(level) }));
  badge.appendChild(inner);
  return badge;
}

function chevronButton() {
  return el("button", {
    type: "button",
    "aria-label": "Show layout stats",
    "aria-expanded": "false",
    style: "flex:none;width:26px;height:26px;border-radius:50%;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;color:rgba(246,241,228,.72);font:700 10px Figtree,sans-serif;cursor:pointer;transition:transform .2s ease",
    text: "▾",
  });
}

function statCell(label, value, sub) {
  const cell = el("div", { style: "flex:1;min-width:0" });
  cell.appendChild(el("div", { style: "font:700 11px Figtree,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:rgba(246,241,228,.42)", text: label }));
  cell.appendChild(el("div", { style: "font:700 15px Figtree,sans-serif;color:#f6f1e4;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", text: value }));
  if (sub) cell.appendChild(el("div", { style: "font:12px Figtree,sans-serif;color:rgba(246,241,228,.5);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", text: sub }));
  return cell;
}

function statsPanelContent(ctx, layout, unlocked) {
  const wrap = el("div", { style: "padding:12px 16px 14px;border-top:1px solid rgba(255,255,255,.08)" });
  if (!unlocked) {
    wrap.appendChild(el("div", { style: "font:13px Figtree,sans-serif;color:rgba(224,138,106,.85)", text: `Unlocks at ${layout.tier} tier.` }));
    return wrap;
  }
  const record = layoutRecordStats(ctx.state.store.rooms, layout.id, ctx.state.currentUser);
  if (record.timesPlayed === 0) {
    wrap.appendChild(el("div", { style: "font:13px Figtree,sans-serif;color:rgba(246,241,228,.5)", text: "No plays yet." }));
    return wrap;
  }
  const row = el("div", { style: "display:flex;gap:14px" });
  row.appendChild(statCell(
    "Fastest",
    record.fastestSeconds != null ? formatClock(record.fastestSeconds) : "—",
    record.fastestHolder || undefined,
  ));
  row.appendChild(statCell("Played", String(record.timesPlayed)));
  row.appendChild(statCell(
    "Your best",
    record.personalBestSeconds != null ? formatClock(record.personalBestSeconds) : "—",
  ));
  wrap.appendChild(row);
  return wrap;
}

function layoutCard(ctx, layout, stats) {
  const unlocked = isLayoutUnlocked(layout, ctx.state.points);
  const card = el("div", {
    style: `width:100%;border-radius:15px;overflow:hidden;background:rgba(255,255,255,.06);border:1px solid ${unlocked ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.07)"}`,
  });

  const row = el("div", {
    role: "button",
    tabindex: "0",
    style: `display:flex;align-items:stretch;min-height:64px;${unlocked ? "cursor:pointer" : "opacity:.62;cursor:default"}`,
  });

  const thumbSlot = el("div", { style: "width:74px;flex:none;padding:8px 4px 8px 8px;display:flex;align-items:center;justify-content:center" });
  thumbSlot.appendChild(layoutThumb(layout, unlocked));
  row.appendChild(thumbSlot);

  const body = el("div", { style: "padding:8px 10px 8px 10px;flex:1;min-width:0;display:flex;align-items:center;gap:8px" });
  const copy = el("div", { style: "flex:1;min-width:0" });
  copy.appendChild(el("div", { style: `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 15px Figtree,sans-serif;color:${unlocked ? "#f6f1e4" : "rgba(246,241,228,.55)"}`, text: layout.name }));
  const difficulty = layout.difficulty[0].toUpperCase() + layout.difficulty.slice(1);
  copy.appendChild(el("div", {
    style: `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px Figtree,sans-serif;color:${unlocked ? "rgba(246,241,228,.52)" : "rgba(224,138,106,.7)"};margin-top:3px`,
    text: `${layout.tileCount} tiles · ${unlocked ? difficulty : layout.tier}`,
  }));
  body.appendChild(copy);
  body.appendChild(levelBadge(stats.boards, { locked: !unlocked }));

  const chevron = chevronButton();
  body.appendChild(chevron);
  row.appendChild(body);
  card.appendChild(row);

  const panel = el("div", { style: "max-height:0;overflow:hidden;transition:max-height .22s ease" });
  card.appendChild(panel);

  let expanded = false;
  function toggle() {
    expanded = !expanded;
    chevron.style.transform = expanded ? "rotate(180deg)" : "";
    chevron.setAttribute("aria-expanded", String(expanded));
    if (expanded) {
      panel.innerHTML = "";
      panel.appendChild(statsPanelContent(ctx, layout, unlocked));
      panel.style.maxHeight = "160px";
    } else {
      panel.style.maxHeight = "0";
    }
  }
  chevron.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  function openRoom() {
    if (!unlocked) {
      ctx.toast(`${layout.name} unlocks at ${layout.tier} tier.`);
      return;
    }
    ctx.navigate("room-setup", { layoutId: layout.id });
  }
  row.addEventListener("click", openRoom);
  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRoom(); }
  });

  return card;
}

export function renderPlayCatalog(root, ctx) {
  let filter = FILTERS[0];
  const layoutStats = completedLayoutStats(ctx.state.store.rooms, ctx.state.currentUser);

  const header = el("div", { class: "catalog-header", style: "padding:calc(8px + env(safe-area-inset-top, 0px)) 20px 12px;display:flex;align-items:center;justify-content:space-between;gap:14px" });
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
