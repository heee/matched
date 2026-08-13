// Matched — Play: layout catalog. Curated, not generated. See
// docs/design-reference.html #1j.

import { el } from "./shared-ui.js";
import { LAYOUTS, layoutSilhouette } from "../game/layouts.js";
import { tierForPoints, TIERS } from "../game/scoring.js";

const FILTERS = ["All", "Easy", "Classic", "Locked"];

function tierIndex(name) {
  return TIERS.findIndex((t) => t.name === name);
}

function isUnlocked(layout, points) {
  if (!layout.tier) return true;
  return tierIndex(tierForPoints(points).name) >= tierIndex(layout.tier);
}

function blockPattern(layout) {
  // True-shape silhouette from the layout's actual bounding box (see
  // layoutSilhouette) — the old version took the first 9 z0 tiles and
  // wrapped x/y with modulo, which made almost every layout's thumbnail
  // collapse into the same generic block of squares regardless of its
  // real footprint. z is kept (not just x/y) because several layouts
  // share the exact same base rectangle — it's the upper layers that
  // actually tell them apart, so those need their own look, not just a
  // flat set of identical squares.
  return layoutSilhouette(layout, 9, 5).map((p) => ({ left: 12 + (p.xPct / 100) * 76, top: 15 + (p.yPct / 100) * 70, z: p.z }));
}

function layoutCard(ctx, layout) {
  const unlocked = isUnlocked(layout, ctx.state.points);
  const card = el("div", {
    style: `border-radius:15px;overflow:hidden;background:rgba(255,255,255,.06);border:1px solid ${unlocked ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.07)"};${unlocked ? "" : "opacity:.72"};cursor:pointer`,
  });
  const thumb = el("div", { style: "height:88px;position:relative;background:radial-gradient(120% 120% at 50% 30%,#1d6349,#0e3527)" });
  blockPattern(layout).forEach(({ left, top, z }) => {
    const upper = z > 0;
    thumb.appendChild(el("div", { style: `position:absolute;left:${left}%;top:${top}%;width:9px;height:12px;margin:-6px 0 0 -4.5px;border-radius:2px;background:${upper ? "#d9a441" : "#f2ecdc"};box-shadow:1px 1px 0 ${upper ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.3)"};z-index:${z}` }));
  });
  if (!unlocked) {
    thumb.appendChild(el("div", { style: "position:absolute;inset:0;background:rgba(8,26,20,.72);display:flex;align-items:center;justify-content:center;font-size:19px", text: "🔒" }));
  }
  card.appendChild(thumb);
  const body = el("div", { style: "padding:10px 12px 12px" });
  body.appendChild(el("div", { style: "font:600 14px Figtree,sans-serif;color:#f6f1e4", text: layout.name }));
  const sub = unlocked
    ? `${layout.tileCount} tiles · ${layout.difficulty}`
    : `${layout.tileCount} tiles · ${layout.tier}`;
  body.appendChild(el("div", { style: `font:11.5px Figtree,sans-serif;color:${unlocked ? "rgba(246,241,228,.5)" : "#e08a6a"};margin-top:3px`, text: sub }));
  card.appendChild(body);

  card.addEventListener("click", () => {
    if (!unlocked) { ctx.toast(`${layout.name} unlocks at ${layout.tier} tier.`); return; }
    ctx.navigate("room-setup", { layoutId: layout.id });
  });
  return card;
}

export function renderPlayCatalog(root, ctx) {
  let filter = "All";
  root.appendChild(el("div", { class: "title-serif", style: "padding:6px 20px 12px" }, "Layouts"));

  const chips = el("div", { style: "padding:0 16px 12px;display:flex;gap:7px" });
  const grid = el("div", { style: "padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px" });

  function renderGrid() {
    grid.innerHTML = "";
    const all = Object.values(LAYOUTS).filter((l) => !l.tabletOnly);
    const filtered = all.filter((l) => {
      if (filter === "All") return true;
      if (filter === "Easy") return l.difficulty === "easy";
      if (filter === "Classic") return l.difficulty === "medium";
      if (filter === "Locked") return !!l.tier;
      return true;
    });
    filtered.forEach((l) => grid.appendChild(layoutCard(ctx, l)));
  }

  FILTERS.forEach((name) => {
    const chip = el("button", { class: `pill${name === filter ? " active" : ""}`, text: name });
    chip.addEventListener("click", () => {
      filter = name;
      [...chips.children].forEach((c) => c.classList.toggle("active", c.textContent === name));
      renderGrid();
    });
    chips.appendChild(chip);
  });
  root.appendChild(chips);
  root.appendChild(grid);
  renderGrid();
  root.appendChild(el("div", { style: "flex:1" }));
}
