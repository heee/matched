// Matched — + Room setup. One scrollable screen, never a wizard. See
// docs/design-reference.html #1i.

import { el } from "./shared-ui.js";
import { LAYOUTS, defaultLayoutForDifficulty, DIFFICULTY_TILE_COUNTS } from "../game/layouts.js";
import { buildLocalRoom } from "../game/room.js";

const MODES = [
  {
    id: "shared", name: "Shared", desc: "One board, everyone tapping. First to a pair takes it.",
    icon: () => {
      const wrap = el("div", { style: "display:flex;gap:3px;margin-bottom:9px;height:20px" });
      for (let i = 0; i < 3; i++) wrap.appendChild(el("div", { style: "width:13px;height:18px;border-radius:3px;background:#f2ecdc" }));
      return wrap;
    },
  },
  {
    id: "race", name: "Race", desc: "Same layout, own board. Live progress bars.",
    icon: () => {
      const wrap = el("div", { style: "display:flex;flex-direction:column;justify-content:center;gap:4px;margin-bottom:9px;height:20px" });
      wrap.appendChild(el("div", { style: "width:30px;height:5px;border-radius:3px;background:#5fbf9b" }));
      wrap.appendChild(el("div", { style: "width:19px;height:5px;border-radius:3px;background:#e08a6a" }));
      return wrap;
    },
  },
  {
    id: "solo", name: "Solo", desc: "Just you. Times still count toward Ranking.",
    icon: () => {
      const wrap = el("div", { style: "display:flex;align-items:center;gap:3px;margin-bottom:9px;height:20px" });
      wrap.appendChild(el("div", { style: "width:13px;height:18px;border-radius:3px;background:#f2ecdc" }));
      wrap.appendChild(el("div", { style: "width:13px;height:18px;border-radius:3px;border:1.5px dashed rgba(242,236,220,.35);box-sizing:border-box" }));
      return wrap;
    },
  },
];

const DIFFICULTIES = ["easy", "medium", "hard"];

export function renderRoomSetup(root, ctx, params = {}) {
  const local = {
    mode: "shared",
    layoutId: params.layoutId || defaultLayoutForDifficulty("medium").id,
    difficulty: params.layoutId ? LAYOUTS[params.layoutId].difficulty === "hard" ? "hard" : LAYOUTS[params.layoutId].difficulty : "medium",
    freeTilesGlow: true,
    hintsAllowed: true,
    openLink: true,
  };

  const header = el("div", { style: "padding:6px 20px 16px;display:flex;align-items:baseline;justify-content:space-between" });
  header.appendChild(el("div", { class: "title-serif", text: "New room" }));
  header.appendChild(el("button", { style: "background:none;border:none;font:600 14px Figtree,sans-serif;color:rgba(246,241,228,.5);cursor:pointer", text: "Cancel", onClick: () => ctx.navigate("home") }));
  root.appendChild(header);

  const body = el("div", { style: "padding:0 16px;display:flex;flex-direction:column;gap:18px" });
  root.appendChild(body);

  // ---- mode ----
  body.appendChild(el("div", { class: "section-label", style: "padding:0 0 9px", text: "Mode" }));
  const modeRow = el("div", { style: "display:flex;gap:8px" });
  function renderModes() {
    modeRow.innerHTML = "";
    MODES.forEach((m) => {
      const active = m.id === local.mode;
      const card = el("div", {
        style: `flex:1;padding:12px;border-radius:15px;background:${active ? "rgba(217,164,65,.16)" : "rgba(255,255,255,.06)"};border:1.5px solid ${active ? "#d9a441" : "rgba(255,255,255,.1)"};cursor:pointer`,
      });
      card.appendChild(m.icon());
      card.appendChild(el("div", { style: "font:700 13.5px Figtree,sans-serif;color:#f6f1e4", text: m.name }));
      card.appendChild(el("div", { style: "font:11px/1.4 Figtree,sans-serif;color:rgba(246,241,228,.6);margin-top:3px", text: m.desc }));
      card.addEventListener("click", () => { local.mode = m.id; renderModes(); });
      modeRow.appendChild(card);
    });
  }
  renderModes();
  body.appendChild(modeRow);

  // ---- layout ----
  body.appendChild(el("div", { class: "section-label", style: "padding:0 0 9px", text: "Layout" }));
  const layoutRow = el("div", { style: "display:flex;align-items:center;gap:13px;padding:13px 14px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);cursor:pointer" });
  function renderLayoutRow() {
    layoutRow.innerHTML = "";
    const layout = LAYOUTS[local.layoutId];
    layoutRow.appendChild(el("div", { style: "flex:none;width:46px;height:40px;border-radius:11px;background:rgba(0,0,0,.2)" }));
    const info = el("div", { style: "flex:1" });
    info.appendChild(el("div", { style: "font:600 15px Figtree,sans-serif;color:#f6f1e4", text: layout.name }));
    info.appendChild(el("div", { style: "font:12px Figtree,sans-serif;color:rgba(246,241,228,.55);margin-top:2px", text: `${layout.tileCount} tiles · ${layout.layers} layers · ${layout.difficulty}` }));
    layoutRow.appendChild(info);
    layoutRow.appendChild(el("div", { style: "font:600 13px Figtree,sans-serif;color:#d9a441", text: "Change" }));
  }
  renderLayoutRow();
  layoutRow.addEventListener("click", () => ctx.navigate("play-catalog"));
  body.appendChild(layoutRow);

  // ---- difficulty ----
  body.appendChild(el("div", { class: "section-label", style: "padding:0 0 9px", text: "Difficulty" }));
  const diffRow = el("div", { style: "display:flex;gap:8px" });
  function renderDiff() {
    diffRow.innerHTML = "";
    DIFFICULTIES.forEach((d) => {
      const active = d === local.difficulty;
      const btn = el("div", {
        style: `flex:1;height:44px;border-radius:12px;background:${active ? "#d9a441" : "rgba(255,255,255,.07)"};display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer`,
      });
      btn.appendChild(el("span", { style: `font:${active ? 700 : 600} 14px Figtree,sans-serif;color:${active ? "#33230a" : "#f6f1e4"}`, text: d[0].toUpperCase() + d.slice(1) }));
      btn.appendChild(el("span", { style: `font:10px Figtree,sans-serif;color:${active ? "rgba(51,35,10,.65)" : "rgba(246,241,228,.45)"}`, text: `${DIFFICULTY_TILE_COUNTS[d]} tiles` }));
      btn.addEventListener("click", () => {
        local.difficulty = d;
        local.layoutId = defaultLayoutForDifficulty(d).id;
        renderDiff();
        renderLayoutRow();
      });
      diffRow.appendChild(btn);
    });
  }
  renderDiff();
  body.appendChild(diffRow);

  // ---- toggles ----
  const toggles = el("div", { style: "display:flex;flex-direction:column;gap:1px;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.07)" });
  function toggleRow(label, key) {
    const row = el("div", { class: "toggle-row" });
    row.appendChild(el("span", { text: label }));
    const t = el("button", { class: `toggle${local[key] ? " on" : ""}`, type: "button" });
    t.appendChild(el("div", { class: "knob" }));
    t.addEventListener("click", () => { local[key] = !local[key]; t.classList.toggle("on", local[key]); });
    row.appendChild(t);
    return row;
  }
  toggles.appendChild(toggleRow("Free tiles glow", "freeTilesGlow"));
  toggles.appendChild(toggleRow("Hints allowed", "hintsAllowed"));
  toggles.appendChild(toggleRow("Open to anyone with the link", "openLink"));
  body.appendChild(toggles);

  root.appendChild(el("div", { style: "flex:1" }));

  const footer = el("div", { style: "padding:14px 16px 30px" });
  footer.appendChild(el("button", {
    class: "btn btn-primary btn-lg", style: "width:100%", text: "Create & invite",
    onClick: () => {
      const layout = LAYOUTS[local.layoutId];
      const room = buildLocalRoom({
        title: layout.name,
        mode: local.mode,
        layoutId: local.layoutId,
        difficulty: local.difficulty,
        visibility: local.openLink ? "open" : "private",
        createdBy: ctx.state.currentUser,
        freeTilesGlow: local.freeTilesGlow,
        hintsAllowed: local.hintsAllowed,
      });
      ctx.state.store.rooms[room.id] = room;
      ctx.state.activeRoomId = room.id;
      ctx.persist();
      if (ctx.api.configured()) {
        ctx.api.createRoom({ title: room.title, mode: room.mode, layoutId: room.layoutId, difficulty: room.difficulty, visibility: room.visibility, createdBy: room.createdBy, freeTilesGlow: room.freeTilesGlow, hintsAllowed: room.hintsAllowed }).catch(() => {});
      }
      ctx.navigate("invite", { roomId: room.id });
    },
  }));
  root.appendChild(footer);
}
