// Matched — small DOM helpers shared across screen modules. Kept out of
// app.js per the "app.js is orchestration only" convention.

import { colorForSeat } from "../game/scoring.js";
import { dotPips, bamSticks, shade, RED } from "../game/tiles.js";

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

// Vibration API has no effect on iOS Safari/PWA (Apple has never
// implemented it) — this silently no-ops there, but still fires correctly
// on Android. `enabled` should be the user's Haptics setting.
export function haptic(enabled, pattern = 12) {
  if (enabled && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
}

// A compact room-mode glyph (shared/race/solo) for list rows — same visual
// language as room-setup's larger mode-picker icons, scaled down into a
// small rounded box. Used where a room's mode needs a quick visual tag
// (e.g. Home's Continue Playing rows, which used to show a literal
// placeholder striped gradient there instead of anything meaningful).
export function modeIcon(mode, size = 42) {
  const box = el("div", { style: `flex:none;width:${size}px;height:${size}px;border-radius:11px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center` });
  if (mode === "race") {
    const wrap = el("div", { style: "display:flex;flex-direction:column;justify-content:center;gap:4px" });
    wrap.appendChild(el("div", { style: "width:20px;height:5px;border-radius:3px;background:#5fbf9b" }));
    wrap.appendChild(el("div", { style: "width:13px;height:5px;border-radius:3px;background:#e08a6a" }));
    box.appendChild(wrap);
  } else if (mode === "solo") {
    const wrap = el("div", { style: "display:flex;align-items:center;gap:3px" });
    wrap.appendChild(el("div", { style: "width:11px;height:15px;border-radius:3px;background:#f2ecdc" }));
    wrap.appendChild(el("div", { style: "width:11px;height:15px;border-radius:3px;border:1.5px dashed rgba(242,236,220,.4);box-sizing:border-box" }));
    box.appendChild(wrap);
  } else {
    const wrap = el("div", { style: "display:flex;gap:3px" });
    for (let i = 0; i < 3; i++) wrap.appendChild(el("div", { style: "width:9px;height:15px;border-radius:2px;background:#f2ecdc" }));
    box.appendChild(wrap);
  }
  return box;
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
      const c = i % 2 ? RED : face.color;
      const rim = shade(c, -30);
      wrap.appendChild(el("div", {
        class: "tile-pip",
        style: `left:${left}%;top:${top}%;width:12px;height:12px;margin:-6px 0 0 -6px;` +
          `background:radial-gradient(circle at 33% 28%, #fff 0%, ${c} 46%, ${rim} 100%);` +
          `box-shadow:0 1px 2px rgba(0,0,0,.35), inset 0 -1.5px 2px rgba(0,0,0,.2);`,
      }));
    });
    container.appendChild(wrap);
  } else if (face.kind === "bam") {
    const wrap = el("div", { style: "position:relative;width:100%;height:100%" });
    const dark = shade(face.color, -32);
    const light = shade(face.color, 38);
    bamSticks(face.n).forEach(({ left, top }) => {
      wrap.appendChild(el("div", {
        class: "tile-stick",
        style: `left:${left}%;top:${top}%;width:5px;height:16px;margin:-8px 0 0 -2.5px;` +
          `background:linear-gradient(90deg, ${dark} 0%, ${light} 32%, ${face.color} 55%, ${dark} 100%);`,
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

const ICON_BELL = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;

// A wiggling bell button for "you have a pending invite" — caller decides
// when to show/hide it and what happens on click.
export function bellButton(onClick) {
  const btn = el("button", { class: "icon-btn amber bell-wiggle", html: ICON_BELL, "aria-label": "Invitations", onClick });
  return btn;
}

// The modal that fires when someone invites you to their room — title,
// who invited you, the room name, and a live link in, or dismiss.
export function inviteNoticeDialog({ fromUser, roomTitle, link }) {
  return new Promise((resolve) => {
    const overlay = el("div", { style: "position:fixed;inset:0;background:rgba(5,15,11,.6);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px" });
    const card = el("div", { style: "max-width:340px;width:100%;background:#183226;border-radius:16px;padding:20px;border:1px solid rgba(255,255,255,.12);text-align:center" });
    card.appendChild(el("div", { style: "font-size:30px;margin-bottom:6px", text: "🔔" }));
    card.appendChild(el("div", { style: "font:700 17px Figtree,sans-serif;color:#f6f1e4", text: "You're invited!" }));
    card.appendChild(el("div", { style: "font:13.5px/1.5 Figtree,sans-serif;color:rgba(246,241,228,.65);margin-top:8px", text: `${fromUser} invited you to ${roomTitle}.` }));
    const row = el("div", { style: "display:flex;gap:10px;margin-top:18px" });
    const dismissBtn = el("button", { class: "btn btn-ghost", style: "flex:1", text: "Not now" });
    const joinBtn = el("button", { class: "btn btn-primary", style: "flex:1", text: "Join" });
    const close = (result) => { overlay.remove(); resolve(result); };
    dismissBtn.addEventListener("click", () => close("dismiss"));
    joinBtn.addEventListener("click", () => close("join"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close("dismiss"); });
    row.appendChild(dismissBtn);
    row.appendChild(joinBtn);
    card.appendChild(row);
    card.appendChild(el("div", { style: "font:11px Figtree,sans-serif;color:rgba(246,241,228,.4);margin-top:12px;word-break:break-all", text: link }));
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
