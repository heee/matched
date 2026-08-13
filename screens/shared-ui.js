// Matched — small DOM helpers shared across screen modules. Kept out of
// app.js per the "app.js is orchestration only" convention.

import { colorForSeat } from "../game/scoring.js";
import { dotPips, bamSticks } from "../game/tiles.js";

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function roomInviteUrl(roomId) {
  return `${location.origin}${location.pathname}#/r/${encodeURIComponent(roomId)}`;
}

export function initialFor(name) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

export function avatarDot(name, seatIndex, size = 34) {
  return el("div", {
    class: "avatar-dot",
    style: `width:${size}px;height:${size}px;background:${colorForSeat(seatIndex)};font-size:${Math.round(size * 0.4)}px`,
    text: initialFor(name),
  });
}

export function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Renders a tile's face content (glyph, pips, or an ART SLOT placeholder)
// into an existing container node — used by both the board screen and any
// layout thumbnail that wants a real tile face, not just a silhouette.
export function renderTileFace(container, face) {
  container.innerHTML = "";
  if (!face) return;
  if (face.kind === "char") {
    const big = !face.bot;
    const top = el("div", {
      class: "tile-char",
      style: `font-size:${big ? 26 : 16}px;color:${face.color}`,
      text: face.top,
    });
    container.appendChild(top);
    if (face.bot) {
      container.appendChild(el("div", { class: "tile-char", style: `font-size:15px;color:${face.color};margin-top:2px`, text: face.bot }));
    }
  } else if (face.kind === "dot") {
    const wrap = el("div", { style: "position:relative;width:100%;height:100%" });
    dotPips(face.n).forEach(([left, top], i) => {
      wrap.appendChild(el("div", {
        class: "tile-pip",
        style: `left:${left}%;top:${top}%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border:2.5px solid ${i % 2 ? "#b5322c" : face.color}`,
      }));
    });
    container.appendChild(wrap);
  } else if (face.kind === "bam") {
    const wrap = el("div", { style: "position:relative;width:100%;height:100%" });
    bamSticks(face.n).forEach(({ left, top }) => {
      wrap.appendChild(el("div", {
        class: "tile-stick",
        style: `left:${left}%;top:${top}%;width:4px;height:15px;margin:-7px 0 0 -2px;background:${face.color}`,
      }));
    });
    container.appendChild(wrap);
  } else if (face.kind === "slot") {
    container.appendChild(el("div", { class: "tile-slot", html: "ART<br>SLOT" }));
  }
}

export function trayFaceGlyph(face) {
  if (!face) return "";
  if (face.kind === "char") return face.top;
  if (face.kind === "dot") return String(face.n);
  if (face.kind === "bam") return String(face.n);
  return "❀";
}

// A small blocking confirm dialog for destructive actions — no existing
// modal pattern in this app, so this is the one reusable version. Resolves
// true/false; never rejects.
export function confirmDialog({ title, message, confirmLabel = "Delete", danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = el("div", { style: "position:fixed;inset:0;background:rgba(5,15,11,.6);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px" });
    const card = el("div", { style: "max-width:340px;width:100%;background:#183226;border-radius:16px;padding:20px;border:1px solid rgba(255,255,255,.12)" });
    card.appendChild(el("div", { style: "font:700 16px Figtree,sans-serif;color:#f6f1e4", text: title }));
    card.appendChild(el("div", { style: "font:13.5px/1.5 Figtree,sans-serif;color:rgba(246,241,228,.65);margin-top:8px", text: message }));
    const row = el("div", { style: "display:flex;gap:10px;margin-top:18px" });
    const cancelBtn = el("button", { class: "btn btn-ghost", style: "flex:1", text: "Cancel" });
    const confirmBtn = el("button", { class: "btn", style: `flex:1;${danger ? "background:#c0453e;color:#fff" : "background:#d9a441;color:#33230a"}`, text: confirmLabel });
    const close = (result) => { overlay.remove(); resolve(result); };
    cancelBtn.addEventListener("click", () => close(false));
    confirmBtn.addEventListener("click", () => close(true));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });
    row.appendChild(cancelBtn);
    row.appendChild(confirmBtn);
    card.appendChild(row);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

export const TAB_DEFS = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "play-catalog", label: "Play", icon: "▦" },
  { id: "room-setup", label: "", icon: "+" },
  { id: "ranking", label: "Ranking", icon: "" },
  { id: "profile", label: "You", icon: "◍" },
];
