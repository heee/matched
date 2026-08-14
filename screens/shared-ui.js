// Matched — small DOM helpers shared across screen modules. Kept out of
// app.js per the "app.js is orchestration only" convention.

import { colorForSeat } from "../game/scoring.js";
import { TILE_W, TILE_H } from "../game/layouts.js";
import { dotPips, bamSticks, RED } from "../game/tiles.js";
import { inkOverrideFor } from "../game/materials.js";

// Tile faces render as inline SVG at this fixed viewBox — it matches the
// on-board tile size (40x52) minus .tile-face's 3px inset on each side, so
// positions computed in these units land at true pixel size with no
// distortion. Every renderTileFace() caller (board.js, race-board.js) uses
// tiles at that same 40x52 size, so one constant covers both.
const FACE_W = TILE_W - 6;
const FACE_H = TILE_H - 6;

// Matches the @media (min-width: 768px) breakpoint in style.css — kept in
// sync manually since CSS can't import this constant.
export const TABLET_MIN_WIDTH = 768;
export function isTabletViewport() {
  return window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH}px)`).matches;
}

// SVG ids must be document-unique for url(#id) to resolve to the right
// element — many tiles are on the board at once, so a fixed id would have
// every tile's filter resolve to whichever one the browser saw first.
let svgUid = 0;
const nextSvgId = (prefix) => `${prefix}${(svgUid++).toString(36)}`;

// Dot/bamboo art. Painted in bone-tile colors and recolored per material
// where needed (see svgWrap's ink filter), so one set serves all ten
// materials. Character tiles (craks/winds/dragons) stay as real Chinese
// web-font typography below; an image model can't be trusted to render
// correct CJK glyphs, and the font was never the part that looked cheap.
const ART = {
  pipRed: "./assets/tiles/bone/pip-red.png",
  pipGreen: "./assets/tiles/bone/pip-green.png",
  bambooStick: "./assets/tiles/bone/bamboo-stick.png",
  bam1Bird: "./assets/tiles/bone/bam1-bird.png",
};

// Hand-painted glyphs never sit perfectly square to the tile, and the
// identical placement across all 34 faces is a big part of what reads as
// printed rather than painted. Seeded by the glyph itself (not the tile
// instance) so a matching pair stays visually identical — spotting pairs is
// the game — while different faces each sit slightly their own way. Kept
// under a degree: past that it stops reading as handwork and starts
// reading as a cartoon.
function charJitter(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rot = ((((h >>> 0) % 1000) / 1000) - 0.5) * 1.3;
  const dx = ((((h >>> 11) % 1000) / 1000) - 0.5) * 0.7;
  return { rot: rot.toFixed(2), dx: dx.toFixed(2) };
}

// A pip image centered at (cx, cy), sized as a square box — the source art
// is itself square, so this never distorts it. The tightest spacing in
// DOT_GRIDS is ~10 units (the 3-column rows), so this is sized just under
// that: adjacent pips nearly touch the way they do on a real tile, without
// overlapping. Raising it past the spacing makes neighbours collide.
const PIP_SIZE = 9.5;
function pipImg(cx, cy, color) {
  const src = color === RED ? ART.pipRed : ART.pipGreen;
  return `<image href="${src}" x="${cx - PIP_SIZE / 2}" y="${cy - PIP_SIZE / 2}" width="${PIP_SIZE}" height="${PIP_SIZE}"/>`;
}

// A bamboo stick image centered at (cx, cy) — the source art is a tall
// single cane, much narrower-than-tall in its native proportions, so it's
// given a box rather than a fixed width/height and left to letterbox
// (default preserveAspectRatio) inside it rather than being stretched.
function bamStickImg(cx, cy) {
  return `<image href="${ART.bambooStick}" x="${cx - 2.5}" y="${cy - 8}" width="5" height="16"/>`;
}

// The 1-bamboo tile traditionally breaks from the plain-stick pattern with
// a bird (a sparrow in most sets, a peacock in fancier ones) — fills the
// whole face, letterboxed to its own aspect ratio.
function bamBirdImg() {
  return `<image href="${ART.bam1Bird}" x="0" y="0" width="${FACE_W}" height="${FACE_H}"/>`;
}

// Recolors artwork to a single flat ink by flooding the filter region and
// keeping it only where the source has alpha. Used for the dark materials,
// whose faces are a single inlaid metal rather than the painted red/green
// of a bone tile — so the same art serves every material and each dark tier
// doesn't need its own generated set.
function inkFilterDef(id, ink) {
  return `<filter id="${id}"><feFlood flood-color="${ink}" result="c"/>` +
    `<feComposite in="c" in2="SourceGraphic" operator="in"/></filter>`;
}

function svgWrap(inner, ink) {
  const open = `<svg viewBox="0 0 ${FACE_W} ${FACE_H}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">`;
  if (!ink) return `${open}${inner}</svg>`;
  const id = nextSvgId("ink");
  return `${open}<defs>${inkFilterDef(id, ink)}</defs><g filter="url(#${id})">${inner}</g></svg>`;
}

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
// `material` is the equipped tile material name; it only affects ink, since
// dark materials swallow the standard red/green/blue face colors.
export function renderTileFace(container, face, material) {
  container.innerHTML = "";
  if (!face) return;
  // Null on the light materials, which keep the art's own painted colors.
  const inkOverride = inkOverrideFor(material);
  const ink = inkOverride || face.color;
  if (face.kind === "char") {
    const big = !face.bot;
    const j = charJitter(`${face.top}${face.bot || ""}`);
    // Both glyphs share one transform so the tile reads as a single painted
    // unit rather than two independently crooked lines.
    const inked = el("div", {
      style: "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        `transform:rotate(${j.rot}deg) translateX(${j.dx}px)`,
    });
    inked.appendChild(el("div", {
      class: "tile-char",
      style: `font-size:${big ? 26 : 16}px;color:${ink}`,
      text: face.top,
    }));
    if (face.bot) {
      inked.appendChild(el("div", { class: "tile-char", style: `font-size:15px;color:${ink};margin-top:2px`, text: face.bot }));
    }
    container.appendChild(inked);
  } else if (face.kind === "dot") {
    const inner = dotPips(face.n).map(([left, top], i) => {
      const c = i % 2 ? RED : face.color;
      return pipImg((left / 100) * FACE_W, (top / 100) * FACE_H, c);
    }).join("");
    container.appendChild(el("div", { style: "width:100%;height:100%", html: svgWrap(inner, inkOverride) }));
  } else if (face.kind === "bam") {
    // The 1-bamboo tile is the one traditional exception to plain sticks —
    // see bamBirdImg().
    const inner = face.n === 1
      ? bamBirdImg()
      : bamSticks(face.n).map(({ left, top }) => bamStickImg((left / 100) * FACE_W, (top / 100) * FACE_H)).join("");
    container.appendChild(el("div", { style: "width:100%;height:100%", html: svgWrap(inner, inkOverride) }));
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
