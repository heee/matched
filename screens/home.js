// Matched — Home screen. Swipeable hero (live now / today's board),
// continue playing, open rooms. See docs/design-reference.html #1d.

import { el, avatarDot, formatClock, roomInviteUrl, modeIcon, bellButton, inviteNoticeDialog } from "./shared-ui.js";
import { boardCompletion } from "../game/mahjong.js";
import { dailyLayoutFor, dailySeedFor, todayDateStr, msUntilNextReset } from "../game/daily.js";
import { LAYOUTS, layoutSilhouette } from "../game/layouts.js";
import { PLAYER_COLORS } from "../game/scoring.js";
import { continuePlayingRooms, openRoomsForUser } from "../game/room-lists.js";
import { repairCurrentPlayerAliases } from "../game/identity.js";

// Randomized invite lines for the Live now card's share button — same
// templated-message-plus-link pattern as Boys Pushup Bonanza's share
// functions, in Matched's own terser voice, filled in with live room state.
const INVITE_MESSAGES = [
  (ctx) => `${ctx.cleared} of ${ctx.total} cleared on ${ctx.title} — come take the rest.`,
  (ctx) => `${ctx.pct}% down on ${ctx.title}. Seats are still open.`,
  (ctx) => `Mid-board on ${ctx.title}, ${ctx.left} tiles left. Jump in?`,
  (ctx) => `${ctx.title} is ${ctx.pct}% cleared and I'm not slowing down 🀄`,
  (ctx) => `Clearing ${ctx.title} right now — grab a pair before I do.`,
  (ctx) => `${ctx.cleared} pairs down on ${ctx.title}. Your seat's still open.`,
  (ctx) => `Board's open: ${ctx.title}, ${ctx.left} tiles left. Come match some tiles.`,
  (ctx) => `On ${ctx.title} — ${ctx.pct}% cleared. Tap in before it's gone.`,
];
let lastInviteTemplate = null;
function pickInviteTemplate() {
  let template, guard = 0;
  do { template = INVITE_MESSAGES[Math.floor(Math.random() * INVITE_MESSAGES.length)]; }
  while (template === lastInviteTemplate && INVITE_MESSAGES.length > 1 && ++guard < 10);
  lastInviteTemplate = template;
  return template;
}

// Lucide's "send" icon — stroke-only paper plane, matches the icon-btn
// glyphs elsewhere on this screen but as an SVG since no emoji reads as a
// plain outline paper airplane.
const PAPER_PLANE_SVG = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;

async function shareLiveRoom(ctx, room) {
  const remaining = room.state.tiles.length;
  const cleared = room.tileCount - remaining;
  const pct = boardCompletion(room.tileCount, remaining);
  const message = pickInviteTemplate()({ title: room.title, cleared, total: room.tileCount, left: remaining, pct });
  const url = roomInviteUrl(room.id);
  const text = `${message} ${url}`;

  // Jump straight to the SMS/Messages compose window on phones — iOS and
  // Android disagree on the query separator for a bodyless sms: link.
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    window.location.href = `sms:${isIOS ? "&" : "?"}body=${encodeURIComponent(text)}`;
    return;
  }
  if (navigator.share) {
    try { await navigator.share({ title: room.title, text: message, url }); } catch (e) { /* user cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    ctx.toast("Copied to clipboard — paste it in your message!");
  } catch (e) {
    ctx.toast("Couldn't share automatically — copy the link manually.");
  }
}

function miniSilhouette(layoutId) {
  const layout = LAYOUTS[layoutId];
  const wrap = el("div", { style: "width:74px;height:60px;position:relative;flex:none" });
  if (!layout) return wrap;
  // True-shape silhouette (see layoutSilhouette) — the old version took
  // the first 5 z0 tiles verbatim, which looked near-identical across
  // every layout regardless of its real footprint. Upper-layer cells (z>0)
  // get a distinct color since several layouts share the same base
  // rectangle and only differ in what's stacked on top.
  layoutSilhouette(layout, 5, 3).forEach((p) => {
    const upper = p.z > 0;
    wrap.appendChild(el("div", {
      style: `position:absolute;left:${4 + (p.xPct / 100) * 50}px;top:${2 + (p.yPct / 100) * 32}px;width:16px;height:21px;border-radius:3px;background:${upper ? "#e8c887" : "#f2ecdc"};box-shadow:2px 2px 0 ${upper ? "#a3792f" : "#a89a78"};z-index:${p.z}`,
    }));
  });
  return wrap;
}

// All three hero card variants share this height so swiping between them
// (e.g. no live room <-> today's board) doesn't visibly jump. Each card is
// a flex column with its non-action content in a flex:1 wrapper, so the
// bottom row (button/actions) always lands at the same height regardless
// of how much the card above it has to say.
const HERO_CARD_HEIGHT = 190;

function liveNowCard(ctx, room) {
  const elapsedS = Math.floor((Date.now() - (room.startedAt || Date.now())) / 1000);
  const remaining = room.state.tiles.length;
  const cleared = room.tileCount - remaining;
  const pct = boardCompletion(room.tileCount, remaining);
  const card = el("div", { class: "gold-card", style: `background:linear-gradient(160deg,rgba(255,255,255,.13),rgba(255,255,255,.05));border-color:rgba(255,255,255,.14);display:flex;flex-direction:column;min-height:${HERO_CARD_HEIGHT}px` });
  const top = el("div", { style: "flex:1" });
  const head = el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:12px" });
  head.appendChild(el("span", { style: "font:700 11px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e8c887", text: "Live now" }));
  head.appendChild(el("span", { style: "font:12px Figtree,sans-serif;color:rgba(246,241,228,.6)", text: formatClock(elapsedS) }));
  top.appendChild(head);

  const body = el("div", { style: "display:flex;gap:14px;align-items:center" });
  body.appendChild(miniSilhouette(room.layoutId));
  const info = el("div", { style: "flex:1;min-width:0" });
  info.appendChild(el("div", { style: "font:700 17px Figtree,sans-serif;color:#f6f1e4", text: room.title }));
  info.appendChild(el("div", { style: "font:12.5px Figtree,sans-serif;color:rgba(246,241,228,.62);margin-top:3px", text: `${room.mode === "shared" ? "Shared board" : room.mode === "race" ? "Race" : "Solo"} · ${room.tileCount} tiles · ${pct}% cleared` }));
  const split = el("div", { class: "progress-split" });
  room.players.forEach((p, i) => {
    const share = cleared > 0 ? Math.round(((room.pairsCleared[p] || 0) / (room.tileCount / 2)) * 100) : 0;
    split.appendChild(el("div", { style: `width:${share}%;background:${PLAYER_COLORS[i % PLAYER_COLORS.length]}` }));
  });
  info.appendChild(split);
  body.appendChild(info);
  top.appendChild(body);
  card.appendChild(top);

  const actions = el("div", { style: "display:flex;gap:10px;margin-top:14px" });
  actions.appendChild(el("button", {
    class: "btn btn-primary", style: "flex:1", text: "Jump back in",
    onClick: () => ctx.navigate(room.mode === "race" ? "race-board" : "board", { roomId: room.id }),
  }));
  actions.appendChild(el("button", {
    class: "icon-btn", style: "width:44px;height:44px", html: PAPER_PLANE_SVG,
    "aria-label": "Share an invite by text",
    onClick: () => shareLiveRoom(ctx, room),
  }));
  card.appendChild(actions);
  return card;
}

function noLiveCard(ctx) {
  const card = el("div", { class: "glass-card", style: `text-align:center;display:flex;flex-direction:column;min-height:${HERO_CARD_HEIGHT}px` });
  const top = el("div", { style: "flex:1;display:flex;flex-direction:column;justify-content:center" });
  top.appendChild(el("div", { style: "font:700 11px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e8c887;margin-bottom:8px", text: "No board in progress" }));
  top.appendChild(el("div", { style: "font:13.5px/1.5 Figtree,sans-serif;color:rgba(246,241,228,.65)", text: "Start a room and clear it with friends, or go solo." }));
  card.appendChild(top);
  card.appendChild(el("button", { class: "btn btn-primary", style: "width:100%", text: "Start a room", onClick: () => ctx.navigate("room-setup") }));
  return card;
}

function dailyCard(ctx) {
  const date = todayDateStr();
  const layoutId = dailyLayoutFor(date);
  const layout = LAYOUTS[layoutId];
  const ms = msUntilNextReset();
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const card = el("div", { class: "gold-card", style: `display:flex;flex-direction:column;min-height:${HERO_CARD_HEIGHT}px` });
  const top = el("div", { style: "flex:1" });
  const head = el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px" });
  head.appendChild(el("span", { style: "font:700 11px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e8c887", text: "Today's board" }));
  head.appendChild(el("span", { style: "font:12px Figtree,sans-serif;color:rgba(246,241,228,.6)", text: `Resets in ${hours}h ${mins}m` }));
  top.appendChild(head);
  top.appendChild(el("div", { class: "title-serif", style: "font-size:24px", text: layout.name }));
  const done = ctx.state.lastDailyCompleted === date;
  top.appendChild(el("div", { style: "font:13px Figtree,sans-serif;color:rgba(246,241,228,.65);margin-top:6px", text: done ? "You finished today's board." : "Everyone plays the same board. One attempt." }));
  card.appendChild(top);
  const actions = el("div", { style: "display:flex;gap:10px;margin-top:14px" });
  actions.appendChild(el("button", { class: "btn btn-primary", style: "flex:1", text: "Play daily", onClick: () => ctx.navigate("daily") }));
  actions.appendChild(el("button", { class: "btn btn-outline", style: "padding:0 16px;height:44px", text: "Results", onClick: () => ctx.navigate("daily") }));
  card.appendChild(actions);
  return card;
}

export function continueRow(ctx, room) {
  const remaining = room.state.tiles.length;
  const pct = boardCompletion(room.tileCount, remaining);
  const row = el("div", { style: "display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07);cursor:pointer" });
  row.addEventListener("click", () => ctx.navigate(room.mode === "race" ? "race-board" : "board", { roomId: room.id }));
  row.appendChild(modeIcon(room.mode));
  const info = el("div", { style: "flex:1;min-width:0" });
  info.appendChild(el("div", { style: "font:600 14.5px Figtree,sans-serif;color:#f6f1e4", text: room.title }));
  info.appendChild(el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.5);margin-top:2px", text: `${room.mode === "race" ? "Race" : "Shared"} · ${pct}% cleared` }));
  info.appendChild(el("div", { class: "progress-thin", style: "margin-top:7px", html: `<div style="width:${pct}%"></div>` }));
  row.appendChild(info);
  const otherIdx = room.players.findIndex((p) => p !== ctx.state.currentUser);
  row.appendChild(avatarDot(room.players[otherIdx] || "?", Math.max(otherIdx, 0), 26));
  return row;
}

function openRow(ctx, room) {
  const row = el("div", { style: "display:flex;align-items:center;gap:13px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08)" });
  row.appendChild(el("div", { style: "flex:none;width:40px;height:40px;border-radius:11px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font:700 13px Figtree,sans-serif;color:#e8c887", text: String(room.tileCount) }));
  const info = el("div", { style: "flex:1;min-width:0" });
  info.appendChild(el("div", { style: "font:600 15px Figtree,sans-serif;color:#f6f1e4", text: room.title }));
  info.appendChild(el("div", { style: "font:12px Figtree,sans-serif;color:rgba(246,241,228,.55);margin-top:2px", text: `${room.mode === "shared" ? "Shared" : room.mode === "race" ? "Race" : "Solo"} · ${room.tileCount} tiles · ${room.players.length} joined` }));
  row.appendChild(info);
  row.appendChild(el("button", {
    class: "btn", style: "background:none;border:none;font:600 12px Figtree,sans-serif;color:#d9a441;padding:0;height:auto", text: "Join",
    onClick: () => {
      repairCurrentPlayerAliases(room, ctx.state.currentUser);
      if (!room.players.includes(ctx.state.currentUser)) room.players.push(ctx.state.currentUser);
      room.pairsCleared[ctx.state.currentUser] = room.pairsCleared[ctx.state.currentUser] || 0;
      room.streaks[ctx.state.currentUser] = room.streaks[ctx.state.currentUser] || 0;
      ctx.state.store.rooms[room.id] = room;
      ctx.persist();
      if (ctx.api.configured()) {
        ctx.api.joinRoom(room.id, ctx.state.currentUser)
          .catch(() => ctx.mutationQueue.enqueue("join-room", { roomId: room.id, user: ctx.state.currentUser }));
      }
      ctx.navigate(room.mode === "race" ? "race-board" : "board", { roomId: room.id });
    },
  }));
  return row;
}

// Invites are local-only for now (see storage.js) — this only reaches the
// recipient if they're a profile on this same device/browser.
function myPendingInvites(ctx) {
  return (ctx.state.store.invites || []).filter((inv) => inv.toUser === ctx.state.currentUser);
}

function removeInvite(ctx, id) {
  ctx.state.store.invites = (ctx.state.store.invites || []).filter((inv) => inv.id !== id);
}

async function showInviteNotice(ctx, invite) {
  const result = await inviteNoticeDialog({ fromUser: invite.fromUser, roomTitle: invite.roomTitle, link: roomInviteUrl(invite.roomId) });
  removeInvite(ctx, invite.id);
  if (result === "join") {
    const room = ctx.state.store.rooms[invite.roomId];
    if (room) {
      repairCurrentPlayerAliases(room, ctx.state.currentUser);
      if (!room.players.includes(ctx.state.currentUser)) {
        room.players.push(ctx.state.currentUser);
        room.pairsCleared[ctx.state.currentUser] = room.pairsCleared[ctx.state.currentUser] || 0;
        room.streaks[ctx.state.currentUser] = room.streaks[ctx.state.currentUser] || 0;
      }
      ctx.persist();
      ctx.navigate(room.mode === "race" ? "race-board" : "board", { roomId: room.id });
      return;
    }
  }
  ctx.persist();
}

export function renderHome(root, ctx) {
  const rooms = Object.values(ctx.state.store.rooms || {});
  const activeRoom = ctx.state.activeRoomId ? ctx.state.store.rooms[ctx.state.activeRoomId] : null;
  const continuePlaying = continuePlayingRooms(rooms, ctx.state.currentUser, ctx.state.activeRoomId);
  const openRooms = openRoomsForUser(rooms, ctx.state.store.users, ctx.state.currentUser);

  const header = el("div", { class: "screen-header" });
  const headLeft = el("div", { style: "flex:1;min-width:0;padding-right:12px" });
  headLeft.appendChild(el("div", { class: "wordmark", text: "Matched" }));
  headLeft.appendChild(el("div", { style: "font:12px Figtree,sans-serif;color:rgba(246,241,228,.55);margin-top:4px", text: `${openRooms.length} open room${openRooms.length === 1 ? "" : "s"} right now` }));
  header.appendChild(headLeft);

  const pending = myPendingInvites(ctx);
  if (pending.length > 0) {
    const bell = bellButton(() => showInviteNotice(ctx, pending[0]));
    bell.style.marginRight = "8px";
    header.appendChild(bell);
  }

  header.appendChild(avatarDot(ctx.state.currentUser, 0, 40));
  header.children[header.children.length - 1].style.cursor = "pointer";
  header.children[header.children.length - 1].addEventListener("click", () => ctx.navigate("profile"));
  root.appendChild(header);

  // Auto-pop the modal once for a brand-new invite (not yet shown), rather
  // than making the user notice and tap the bell themselves the first time.
  const fresh = pending.find((inv) => !inv.notified);
  if (fresh) {
    fresh.notified = true;
    ctx.persist();
    showInviteNotice(ctx, fresh);
  }

  // ---- swipeable hero ----
  let heroIndex = 0;
  const heroWrap = el("div", { class: "hero-wrap", style: "display:flex;align-items:center;gap:3px;margin:4px 10px 0" });
  const prevBtn = el("div", { text: "‹", style: "flex:none;width:18px;height:56px;display:flex;align-items:center;justify-content:center;font:300 22px Figtree,sans-serif;color:rgba(246,241,228,.55);cursor:pointer;user-select:none" });
  const nextBtn = el("div", { text: "›", style: "flex:none;width:18px;height:56px;display:flex;align-items:center;justify-content:center;font:300 22px Figtree,sans-serif;color:rgba(246,241,228,.55);cursor:pointer;user-select:none" });
  const cardSlot = el("div", { style: "flex:1;min-width:0" });
  const dots = el("div", { style: "display:flex;justify-content:center;gap:6px;margin-top:10px" });

  function setHero(i) {
    heroIndex = (i + 2) % 2;
    cardSlot.innerHTML = "";
    cardSlot.appendChild(heroIndex === 0 ? (activeRoom ? liveNowCard(ctx, activeRoom) : noLiveCard(ctx)) : dailyCard(ctx));
    [...dots.children].forEach((d, i2) => {
      d.style.width = i2 === heroIndex ? "18px" : "6px";
      d.style.background = i2 === heroIndex ? "#d9a441" : "rgba(246,241,228,.25)";
    });
  }
  for (let i = 0; i < 2; i++) {
    const dot = el("div", { style: "height:6px;border-radius:3px;transition:width .2s;cursor:pointer" });
    dot.addEventListener("click", () => setHero(i));
    dots.appendChild(dot);
  }
  prevBtn.addEventListener("click", () => setHero(heroIndex - 1));
  nextBtn.addEventListener("click", () => setHero(heroIndex + 1));

  // Swipe/drag between cards. touch-action:pan-y leaves vertical page
  // scroll alone but tells the browser not to treat a horizontal drag here
  // as a scroll gesture, and pointer capture keeps the up-event landing on
  // cardSlot even if the finger/cursor strays outside it mid-swipe.
  cardSlot.style.touchAction = "pan-y";
  cardSlot.style.userSelect = "none";
  let dragStartX = null;
  let dragPointerId = null;
  cardSlot.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return; // let the card's own buttons work untouched
    e.preventDefault(); // stop desktop text-selection drag from competing with the swipe
    dragStartX = e.clientX;
    dragPointerId = e.pointerId;
    cardSlot.setPointerCapture(e.pointerId);
  });
  cardSlot.addEventListener("pointerup", (e) => {
    if (dragStartX == null) return;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 40) setHero(heroIndex + (dx < 0 ? 1 : -1));
    dragStartX = null;
    dragPointerId = null;
  });
  cardSlot.addEventListener("pointercancel", () => { dragStartX = null; dragPointerId = null; });
  cardSlot.addEventListener("lostpointercapture", () => { dragStartX = null; dragPointerId = null; });
  heroWrap.appendChild(prevBtn);
  heroWrap.appendChild(cardSlot);
  heroWrap.appendChild(nextBtn);
  root.appendChild(heroWrap);
  root.appendChild(dots);
  setHero(0);

  const continueLabel = el("div", { class: "section-label section-label-row", style: "padding-top:20px" });
  continueLabel.appendChild(el("span", { text: "Continue playing" }));
  if (continuePlaying.length > 3) {
    continueLabel.appendChild(el("button", {
      class: "pill section-more",
      text: "More",
      "aria-label": "See all rooms to continue playing",
      onClick: () => ctx.navigate("continue-playing"),
    }));
  }
  root.appendChild(continueLabel);
  const continueList = el("div", { class: "row-list" });
  if (continuePlaying.length === 0) continueList.appendChild(el("div", { class: "empty-note", style: "padding:0 4px", text: "Rooms you've joined but aren't in right now will show up here." }));
  continuePlaying.slice(0, 3).forEach((r) => continueList.appendChild(continueRow(ctx, r)));
  root.appendChild(continueList);

  root.appendChild(el("div", { class: "section-label", style: "padding-top:20px", text: "Open rooms" }));
  root.appendChild(el("div", { class: "section-helper", text: "Started by other players and open for you to join." }));
  const openList = el("div", { class: "row-list" });
  if (openRooms.length === 0) openList.appendChild(el("div", { class: "empty-note", style: "padding:0 4px", text: "No open rooms yet — create one from the + tab." }));
  openRooms.forEach((r) => openList.appendChild(openRow(ctx, r)));
  root.appendChild(openList);

  root.appendChild(el("div", { style: "flex:1" }));
}
