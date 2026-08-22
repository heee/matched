// Matched — Home screen. Swipeable hero (live now / today's board),
// continue playing, open rooms. See docs/design-reference.html #1d.

import { el, avatarDot, formatClock, roomInviteUrl, modeIcon, bellButton, inviteNoticeDialog } from "./shared-ui.js";
import { boardCompletion } from "../game/mahjong.js";
import { dailyLayoutFor, dailySeedFor, todayDateStr, msUntilNextReset } from "../game/daily.js";
import { LAYOUTS, layoutSilhouette } from "../game/layouts.js";
import { PLAYER_COLORS, TIERS, colorForSeat, levelProgress, nextCosmeticUnlock, nextTier, tierForPoints } from "../game/scoring.js";
import { materialFor } from "../game/materials.js";
import { continuePlayingRooms, hasStartedRoom, openRoomsForUser, randomRoomSample } from "../game/room-lists.js";
import { repairCurrentPlayerAliases } from "../game/identity.js";
import { completedWeekStats } from "../game/daily-stats.js";
import { topRegisteredRankings } from "../game/ranking.js";
import { liveBoardShareMessage } from "../game/share-messages.js";

// Lucide's "send" icon — stroke-only paper plane, matches the icon-btn
// glyphs elsewhere on this screen but as an SVG since no emoji reads as a
// plain outline paper airplane.
const PAPER_PLANE_SVG = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;

async function shareLiveRoom(ctx, room) {
  const remaining = room.state.tiles.length;
  const cleared = room.tileCount - remaining;
  const pct = boardCompletion(room.tileCount, remaining);
  const message = liveBoardShareMessage({ title: room.title, cleared, total: room.tileCount, left: remaining, pct });
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

// All four hero card variants share this height so swiping between them
// (e.g. no live room <-> today's board) doesn't visibly jump. Each card is
// a flex column with its non-action content in a flex:1 wrapper, so the
// bottom row (button/actions) always lands at the same height regardless
// of how much the card above it has to say.
const HERO_CARD_HEIGHT = 252;
const GROUP_METRICS = [
  { id: "pairs", label: "Pairs" },
  { id: "speed", label: "Speed" },
  { id: "share", label: "Board share" },
];

function formatGroupMetric(value, metric) {
  if (metric === "speed") return value > 0 ? formatClock(value) : "—";
  if (metric === "share") return `${value}%`;
  return String(value);
}

function groupGapCopy(rows, currentUser, metric) {
  const leader = rows[0];
  const me = rows.find((row) => row.name === currentUser);
  if (!leader || leader.value === 0) return "No group results yet today. Set the pace.";
  if (!me || me.value === 0) return metric === "speed"
    ? `No timed board yet. ${leader.name} set the pace.`
    : `${leader.name} leads today. Play to close the gap.`;
  if (leader.name === currentUser) return "You lead today. Keep it going.";
  if (metric === "speed") return `${formatClock(Math.max(0, me.value - leader.value))} behind ${leader.name}. Play to close it.`;
  const gap = Math.max(0, leader.value - me.value);
  return metric === "share"
    ? `${gap} point${gap === 1 ? "" : "s"} behind ${leader.name}. Play to close it.`
    : `${gap} pair${gap === 1 ? "" : "s"} behind ${leader.name}. Play to close it.`;
}

function groupRankingCard(ctx, metric, onChangeMetric) {
  const allRows = topRegisteredRankings(ctx.state.store.rooms, ctx.state.store.users, "Today", metric, Number.MAX_SAFE_INTEGER);
  const rows = allRows.slice(0, 3);
  const userOrder = [...new Set([...Object.keys(ctx.state.store.users || {}), ...allRows.map((row) => row.name)])];
  const leaderValue = rows[0]?.value || 0;
  const card = el("div", { class: "glass-card group-card", style: `height:${HERO_CARD_HEIGHT}px` });
  const head = el("div", { class: "group-card-head" });
  head.appendChild(el("span", { text: "Today in your group" }));
  const metricIndex = GROUP_METRICS.findIndex((candidate) => candidate.id === metric);
  head.appendChild(el("button", {
    class: "group-metric-button",
    text: GROUP_METRICS[metricIndex].label,
    "aria-label": `Showing ${GROUP_METRICS[metricIndex].label.toLowerCase()}. Change group metric`,
    onClick: () => onChangeMetric(GROUP_METRICS[(metricIndex + 1) % GROUP_METRICS.length].id),
  }));
  card.appendChild(head);

  const list = el("div", { class: "group-rank-list" });
  rows.forEach((row) => {
    const isMe = row.name === ctx.state.currentUser;
    const seat = Math.max(0, userOrder.indexOf(row.name));
    const color = colorForSeat(seat);
    const width = row.value <= 0 || leaderValue <= 0
      ? 0
      : metric === "speed" ? Math.min(100, (leaderValue / row.value) * 100) : Math.min(100, (row.value / leaderValue) * 100);
    const rankRow = el("div", { class: `group-rank-row${isMe ? " me" : ""}` });
    rankRow.appendChild(avatarDot(row.name, seat, 30));
    const body = el("div", { class: "group-rank-body" });
    const line = el("div", { class: "group-rank-line" });
    line.appendChild(el("span", { text: isMe ? "You" : row.name }));
    line.appendChild(el("strong", { text: formatGroupMetric(row.value, metric) }));
    body.appendChild(line);
    body.appendChild(el("div", { class: "group-rank-bar", html: `<div style="width:${width}%;background:${color}"></div>` }));
    rankRow.appendChild(body);
    list.appendChild(rankRow);
  });
  card.appendChild(list);

  const footer = el("div", { class: "group-card-footer" });
  footer.appendChild(el("div", { text: groupGapCopy(allRows, ctx.state.currentUser, metric) }));
  footer.appendChild(el("button", { class: "btn btn-primary", text: "Play", onClick: () => ctx.navigate("room-setup") }));
  card.appendChild(footer);
  return card;
}

function overallLevelCard(ctx) {
  const points = Math.max(0, Number(ctx.state.points) || 0);
  const progress = levelProgress(points);
  const tier = tierForPoints(points);
  const tierNext = nextTier(points);
  const tierIdx = TIERS.findIndex((candidate) => candidate.name === tier.name);
  const tierStart = tier.threshold;
  const tierEnd = tierNext?.threshold ?? tierStart + Math.max(1, tierStart - (TIERS[tierIdx - 1]?.threshold ?? 0));
  const tierProgressPct = tierNext
    ? Math.max(0, Math.min(100, ((points - tierStart) / (tierEnd - tierStart)) * 100))
    : 100;
  const unlock = nextCosmeticUnlock(points);
  const material = materialFor(tier.material);
  const unlockName = unlock
    ? `${unlock.label}${unlock.kind === "material" ? " tiles unlock" : " unlocks"} at ${unlock.tierName} tier`
    : "All table styles unlocked";

  const card = el("div", {
    class: "level-card",
    role: "button",
    tabindex: "0",
    "aria-label": `Overall level ${progress.level}. Open profile`,
    onClick: () => ctx.navigate("profile"),
  });
  card.style.height = `${HERO_CARD_HEIGHT}px`;
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      ctx.navigate("profile");
    }
  });

  const head = el("div", { class: "level-card-head" });
  head.appendChild(el("span", { text: "Your level" }));
  head.appendChild(el("span", { text: `${tier.name} tier` }));
  card.appendChild(head);

  const body = el("div", { class: "level-card-body" });
  const badge = el("div", {
    class: "level-badge",
    style: `--level-progress:${progress.progressPct * 3.6}deg;--level-face-a:${material.a};--level-face-b:${material.b};--level-edge:${material.edge}`,
  });
  const badgeFace = el("div", { class: "level-badge-face" });
  badgeFace.appendChild(el("span", { text: "Level" }));
  badgeFace.appendChild(el("strong", { text: String(progress.level) }));
  badge.appendChild(badgeFace);
  body.appendChild(badge);

  const info = el("div", { class: "level-card-info" });
  info.appendChild(el("div", { class: "level-points", text: `${points.toLocaleString()} points` }));
  info.appendChild(el("div", { class: "level-next", text: `${progress.pointsToNext.toLocaleString()} to level ${progress.nextLevel}` }));
  info.appendChild(el("div", {
    class: "level-tier-progress",
    html: `<div style="width:${tierProgressPct}%"></div>`,
    "aria-label": `${Math.round(tierProgressPct)}% through ${tier.name} tier`,
  }));
  const unlockRow = el("div", { class: "level-unlock" });
  unlockRow.appendChild(el("span", {
    class: "level-material-swatch",
    style: `--level-face-a:${material.a};--level-face-b:${material.b};--level-edge:${material.edge}`,
  }));
  unlockRow.appendChild(el("span", { text: unlockName }));
  info.appendChild(unlockRow);
  body.appendChild(info);
  card.appendChild(body);
  return card;
}

function liveNowCard(ctx, room) {
  const elapsedS = Math.floor((Date.now() - (room.startedAt || Date.now())) / 1000);
  const remaining = room.state.tiles.length;
  const cleared = room.tileCount - remaining;
  const pct = boardCompletion(room.tileCount, remaining);
  const card = el("div", { class: "gold-card", style: `background:linear-gradient(160deg,rgba(255,255,255,.13),rgba(255,255,255,.05));border-color:rgba(255,255,255,.14);display:flex;flex-direction:column;height:${HERO_CARD_HEIGHT}px` });
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
  const card = el("div", { class: "glass-card", style: `text-align:center;display:flex;flex-direction:column;height:${HERO_CARD_HEIGHT}px` });
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
  const card = el("div", { class: "gold-card", style: `display:flex;flex-direction:column;height:${HERO_CARD_HEIGHT}px` });
  const top = el("div", { style: "flex:1" });
  const head = el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px" });
  head.appendChild(el("span", { style: "font:700 11px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#e8c887", text: "Today's board" }));
  head.appendChild(el("span", { style: "font:12px Figtree,sans-serif;color:rgba(246,241,228,.6)", text: `Resets in ${hours}h ${mins}m` }));
  top.appendChild(head);
  top.appendChild(el("div", { class: "title-serif", style: "font-size:24px", text: layout.name }));
  const done = ctx.state.dailyCompletedByUser?.[ctx.state.currentUser] === date;
  top.appendChild(el("div", { style: "font:13px Figtree,sans-serif;color:rgba(246,241,228,.65);margin-top:6px", text: done ? "You finished today's board." : "Everyone plays the same board. One attempt." }));
  card.appendChild(top);
  const actions = el("div", { style: "display:flex;gap:10px;margin-top:14px" });
  if (done) {
    actions.appendChild(el("button", { class: "btn btn-primary", style: "flex:1", text: "View results", onClick: () => ctx.navigate("daily") }));
  } else {
    actions.appendChild(el("button", { class: "btn btn-primary", style: "flex:1", text: "Play daily", onClick: () => ctx.navigate("daily") }));
    actions.appendChild(el("button", { class: "btn btn-outline", style: "padding:0 16px;height:44px", text: "Results", onClick: () => ctx.navigate("daily") }));
  }
  card.appendChild(actions);
  return card;
}

function dailyOverviewCard(ctx) {
  const week = completedWeekStats(ctx.state.store.rooms, ctx.state.currentUser);
  const stats = week[week.length - 1];
  const yesterday = week[week.length - 2];
  const pairDelta = stats.pairs - yesterday.pairs;
  const avgTime = stats.avgTimeS == null ? "—" : formatClock(stats.avgTimeS);
  const todayLabel = `${stats.date.toLocaleDateString("en-US", { weekday: "short" })} ${stats.date.getDate()} ${stats.date.toLocaleDateString("en-US", { month: "short" })}`;
  const firstDayLabel = week[0].date.toLocaleDateString("en-US", { weekday: "short" });
  const card = el("div", { class: "glass-card daily-overview-card", style: `height:${HERO_CARD_HEIGHT}px` });
  const head = el("div", { class: "daily-overview-head" });
  head.appendChild(el("span", { text: "Your day" }));
  head.appendChild(el("span", { text: todayLabel }));
  card.appendChild(head);

  const hero = el("div", { class: "daily-hero-metric" });
  hero.appendChild(el("strong", { text: String(stats.pairs) }));
  const heroCopy = el("div");
  heroCopy.appendChild(el("span", { text: stats.pairs === 1 ? "pair matched" : "pairs matched" }));
  if (pairDelta !== 0) {
    heroCopy.appendChild(el("small", {
      class: pairDelta > 0 ? "improved" : "",
      text: pairDelta > 0 ? `+${pairDelta} on yesterday` : `${Math.abs(pairDelta)} fewer than yesterday`,
    }));
  }
  hero.appendChild(heroCopy);
  card.appendChild(hero);

  const chart = el("div", { class: "daily-week-chart", "aria-label": `Pairs matched over the last seven days: ${week.map((day) => day.pairs).join(", ")}` });
  const bars = el("div", { class: "daily-week-bars" });
  const maxPairs = Math.max(1, ...week.map((day) => day.pairs));
  week.forEach((day, index) => {
    const heightPct = day.pairs > 0 ? Math.max(14, (day.pairs / maxPairs) * 100) : 5;
    bars.appendChild(el("span", { class: index === week.length - 1 ? "today" : "", style: `height:${heightPct}%` }));
  });
  chart.appendChild(bars);
  const chartLabels = el("div", { class: "daily-week-labels" });
  chartLabels.appendChild(el("span", { text: firstDayLabel }));
  chartLabels.appendChild(el("span", { text: "Last 7 days" }));
  chartLabels.appendChild(el("span", { text: "Today" }));
  chart.appendChild(chartLabels);
  card.appendChild(chart);

  const support = el("div", { class: "daily-support-metrics" });
  const supportItems = [
    [stats.boards, stats.boards === 1 ? "board" : "boards"],
    [avgTime, "avg"],
    [stats.bestStreak, "best run"],
  ];
  for (const [value, label] of supportItems) {
    const item = el("div");
    item.appendChild(el("strong", { text: String(value) }));
    item.appendChild(el("span", { text: label }));
    support.appendChild(item);
  }
  card.appendChild(support);
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

export function openRow(ctx, room) {
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
  const activeCandidate = ctx.state.activeRoomId ? ctx.state.store.rooms[ctx.state.activeRoomId] : null;
  const activeRoom = hasStartedRoom(activeCandidate, ctx.state.currentUser) ? activeCandidate : null;
  const continuePlaying = continuePlayingRooms(rooms, ctx.state.currentUser, ctx.state.activeRoomId);
  const openRooms = openRoomsForUser(rooms, ctx.state.store.users, ctx.state.currentUser);
  const featuredOpenRooms = randomRoomSample(openRooms, 3);

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
  let groupMetric = "pairs";
  const heroCount = 5;
  const heroWrap = el("div", { class: "hero-wrap", style: "display:flex;align-items:center;gap:3px;margin:4px 10px 0" });
  const prevBtn = el("div", { text: "‹", style: "flex:none;width:18px;height:56px;display:flex;align-items:center;justify-content:center;font:300 22px Figtree,sans-serif;color:rgba(246,241,228,.55);cursor:pointer;user-select:none" });
  const nextBtn = el("div", { text: "›", style: "flex:none;width:18px;height:56px;display:flex;align-items:center;justify-content:center;font:300 22px Figtree,sans-serif;color:rgba(246,241,228,.55);cursor:pointer;user-select:none" });
  const cardSlot = el("div", { style: "flex:1;min-width:0" });
  const dots = el("div", { style: "display:flex;justify-content:center;gap:6px;margin-top:10px" });

  function setHero(i) {
    heroIndex = (i + heroCount) % heroCount;
    cardSlot.innerHTML = "";
    const cards = [
      overallLevelCard(ctx),
      activeRoom ? liveNowCard(ctx, activeRoom) : noLiveCard(ctx),
      dailyCard(ctx),
      dailyOverviewCard(ctx),
      groupRankingCard(ctx, groupMetric, (nextMetric) => { groupMetric = nextMetric; setHero(heroIndex); }),
    ];
    cardSlot.appendChild(cards[heroIndex]);
    [...dots.children].forEach((d, i2) => {
      d.style.width = i2 === heroIndex ? "18px" : "6px";
      d.style.background = i2 === heroIndex ? "#d9a441" : "rgba(246,241,228,.25)";
    });
  }
  for (let i = 0; i < heroCount; i++) {
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

  const openLabel = el("div", { class: "section-label section-label-row", style: "padding-top:20px" });
  openLabel.appendChild(el("span", { text: "Open rooms" }));
  if (openRooms.length > 3) {
    openLabel.appendChild(el("button", {
      class: "pill section-more",
      text: "More",
      "aria-label": "See all open rooms",
      onClick: () => ctx.navigate("open-rooms"),
    }));
  }
  root.appendChild(openLabel);
  root.appendChild(el("div", { class: "section-helper", text: "Started by other players and open for you to join." }));
  const openList = el("div", { class: "row-list" });
  if (openRooms.length === 0) openList.appendChild(el("div", { class: "empty-note", style: "padding:0 4px", text: "No open rooms yet — create one from the + tab." }));
  featuredOpenRooms.forEach((r) => openList.appendChild(openRow(ctx, r)));
  root.appendChild(openList);

  root.appendChild(el("div", { style: "flex:1" }));
}
