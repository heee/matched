// Matched — Play: layout catalog. Curated, not generated. See
// docs/design-reference.html #1j and the layout-level design extension.

import { el, isTabletViewport, formatClock, avatarDot, trayFaceGlyph } from "./shared-ui.js";
import { LAYOUTS, layoutSilhouette, isLayoutUnlocked } from "../game/layouts.js";
import { layoutThemeFaces } from "../game/tiles.js";
import { completedLayoutStats, layoutRecordStats } from "../game/layout-stats.js";
import { layoutLevelProgress } from "../game/layout-levels.js";

const FILTERS = ["All difficulties", "Easy", "Medium", "Hard"];

// A thumbnail of real tiles (themed to the layout — dragons, winds,
// character glyphs, ...), styled after the match tray's tray-tile (see
// .tray-tile in style.css): small flat cream chips with a centered glyph,
// at their own true small size — never a CSS-scaled-down full board tile.
// An earlier version reused the board's full-size .tile + renderTileFace
// scaled down 70% via `transform: scale()`; at that size the box-shadow,
// gradient, and CJK glyphs turned to near-invisible sub-pixel noise, which
// is what actually shipped. These stay crisp at any size.
//
// Layout to layout, the base footprint (layoutSilhouette's z===0 cells) is
// nearly always a filled rectangle — what actually varies is how tall the
// pyramid built on top of it gets (maxZ), which is exactly what a real
// player would recognize as "how complex is this board". So the thumbnail
// maps layoutSilhouette's coarse grid straight onto the box (real footprint,
// real per-cell layer height) rather than a synthetic uniform grid: taller
// stacks sit higher (offset up-right) and glow brighter, echoing .tile.upper.
const THUMB_W = 58;
const THUMB_H = 46;
const THUMB_COLS = 4;
const THUMB_ROWS = 3;
const MINI_TILE_W = 8;
const MINI_TILE_H = 11;
const LAYER_OFFSET_PX = 1.6;
const MARGIN_X = MINI_TILE_W * 0.9;
const MARGIN_Y = MINI_TILE_H * 0.9;

function miniGlyphTile(face, leftPx, topPx, z) {
  const lit = z > 0;
  return el("div", {
    style: `position:absolute;left:${leftPx}px;top:${topPx}px;width:${MINI_TILE_W}px;height:${MINI_TILE_H}px;border-radius:2px;background:linear-gradient(160deg,${lit ? "#fffdf6,#f3ecd8" : "#f9f4e6,#e7dec8"});box-shadow:${lit ? "0 1px 0 rgba(0,0,0,.22),0 1.5px 2px rgba(0,0,0,.3)" : "0 1px 0 rgba(0,0,0,.22)"};display:flex;align-items:center;justify-content:center;font:700 6.5px var(--font-tile);color:${face.color || "#23201c"};z-index:${Math.round(z * 10)}`,
    text: trayFaceGlyph(face),
  });
}

function layoutThumb(layout, unlocked) {
  const box = el("div", {
    style: `width:${THUMB_W}px;height:${THUMB_H}px;position:relative;border-radius:10px;overflow:hidden;background:#0e3a2b`,
  });
  const faces = layoutThemeFaces(layout);
  const cells = layoutSilhouette(layout, THUMB_COLS, THUMB_ROWS).sort((a, b) => a.z - b.z);
  const usableW = THUMB_W - MARGIN_X * 2 - MINI_TILE_W;
  const usableH = THUMB_H - MARGIN_Y * 2 - MINI_TILE_H;
  cells.forEach((cell, i) => {
    const leftPx = MARGIN_X + (cell.xPct / 100) * usableW + cell.z * LAYER_OFFSET_PX;
    const topPx = MARGIN_Y + (cell.yPct / 100) * usableH - cell.z * LAYER_OFFSET_PX;
    const face = faces[Math.floor(i / 2) % faces.length];
    box.appendChild(miniGlyphTile(face, leftPx, topPx, cell.z));
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

function chevronButton(active) {
  return el("button", {
    type: "button",
    "aria-label": active ? "Show layout stats" : "No stats yet for this layout",
    "aria-expanded": "false",
    disabled: active ? undefined : "true",
    style: `flex:none;width:26px;height:26px;border-radius:50%;border:1px solid rgba(255,255,255,${active ? ".13" : ".06"});background:rgba(255,255,255,${active ? ".07" : ".03"});display:flex;align-items:center;justify-content:center;color:rgba(246,241,228,${active ? ".72" : ".22"});font:700 10px Figtree,sans-serif;transition:transform .2s ease;${active ? "cursor:pointer" : "cursor:default"}`,
    text: "▾",
  });
}

// One row of the expanded stat panel: a label on the left, a value with
// the holder's avatar + name on the right (per the design reference —
// "who set it" reads as a small avatar chip, not just a name string).
function recordRow(ctx, label, value, holderName) {
  const row = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0" });
  row.appendChild(el("div", { style: "font:13px Figtree,sans-serif;color:rgba(246,241,228,.6)", text: label }));
  const right = el("div", { style: "display:flex;align-items:center;gap:8px;min-width:0" });
  right.appendChild(el("div", { style: "font:700 16px Figtree,sans-serif;color:#f6f1e4;flex:none", text: value }));
  if (holderName) {
    const isYou = holderName === ctx.state.currentUser;
    right.appendChild(avatarDot(holderName, 0, 20, ctx.state.store.users));
    right.appendChild(el("div", {
      style: "font:13px Figtree,sans-serif;color:rgba(246,241,228,.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px",
      text: isYou ? "You" : holderName,
    }));
  }
  row.appendChild(right);
  return row;
}

function statsPanelContent(ctx, layout, record) {
  const wrap = el("div", { style: "padding:2px 16px 12px;border-top:1px solid rgba(255,255,255,.08)" });
  wrap.appendChild(recordRow(
    ctx,
    "Fastest time",
    record.fastestSeconds != null ? formatClock(record.fastestSeconds) : "—",
    record.fastestHolder,
  ));
  wrap.appendChild(recordRow(
    ctx,
    "Most active",
    record.mostActive ? `${record.mostActive.count} plays` : "—",
    record.mostActive?.name,
  ));
  wrap.appendChild(recordRow(
    ctx,
    "Your best",
    record.personalBestSeconds != null ? formatClock(record.personalBestSeconds) : "—",
    ctx.state.currentUser,
  ));
  return wrap;
}

function layoutCard(ctx, layout, stats) {
  const unlocked = isLayoutUnlocked(layout, ctx.state.points);
  const record = layoutRecordStats(ctx.state.store.rooms, layout.id, ctx.state.currentUser);
  const hasData = unlocked && record.totalPlays > 0;

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

  const chevron = chevronButton(hasData);
  body.appendChild(chevron);
  row.appendChild(body);
  card.appendChild(row);

  const panel = el("div", { style: "max-height:0;overflow:hidden;transition:max-height .22s ease" });
  card.appendChild(panel);

  if (hasData) {
    let expanded = false;
    chevron.addEventListener("click", (e) => {
      e.stopPropagation();
      expanded = !expanded;
      chevron.style.transform = expanded ? "rotate(180deg)" : "";
      chevron.setAttribute("aria-expanded", String(expanded));
      if (expanded) {
        panel.innerHTML = "";
        panel.appendChild(statsPanelContent(ctx, layout, record));
        panel.style.maxHeight = "160px";
      } else {
        panel.style.maxHeight = "0";
      }
    });
  }

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
