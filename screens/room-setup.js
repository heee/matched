// Matched — + Room setup. One scrollable screen, never a wizard. See
// docs/design-reference.html #1i.

import { el, avatarDot } from "./shared-ui.js";
import { LAYOUTS, defaultLayoutForDifficulty, DIFFICULTY_TILE_COUNTS } from "../game/layouts.js";
import { buildLocalRoom } from "../game/room.js?v=8";
import { BOT_DIFFICULTIES, BOT_NAME_POOL } from "../game/scoring.js";
import { isActualPlayerName } from "../game/identity.js";

// Optional bot seats for Shared/Race rooms — off by default. A seat left
// dotted/empty isn't filled by a bot; it just stays open for a real player
// to join later, same as any other open seat.
const BOT_SEAT_COUNT = 3;

const MODES = [
  {
    id: "solo", name: "Solo", desc: "Just you. Times still count toward Ranking.",
    icon: () => {
      const wrap = el("div", { style: "display:flex;align-items:center;gap:3px;margin-bottom:9px;height:20px" });
      wrap.appendChild(el("div", { style: "width:13px;height:18px;border-radius:3px;background:#f2ecdc" }));
      wrap.appendChild(el("div", { style: "width:13px;height:18px;border-radius:3px;border:1.5px dashed rgba(242,236,220,.35);box-sizing:border-box" }));
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
    id: "shared", name: "Shared", desc: "One board, everyone tapping. First to a pair takes it.",
    icon: () => {
      const wrap = el("div", { style: "display:flex;gap:3px;margin-bottom:9px;height:20px" });
      for (let i = 0; i < 3; i++) wrap.appendChild(el("div", { style: "width:13px;height:18px;border-radius:3px;background:#f2ecdc" }));
      return wrap;
    },
  },
  {
    id: "live", name: "Live", desc: "One device, passed around. Everyone takes a turn.",
    icon: () => {
      const wrap = el("div", { style: "display:flex;align-items:flex-end;gap:3px;margin-bottom:9px;height:20px" });
      wrap.appendChild(el("div", { style: "width:13px;height:18px;border-radius:3px;background:#f2ecdc" }));
      wrap.appendChild(el("div", { style: "width:8px;height:8px;border-radius:50%;background:rgba(242,236,220,.4);margin:0 1px 3px" }));
      wrap.appendChild(el("div", { style: "width:13px;height:14px;border-radius:3px;background:rgba(242,236,220,.35)" }));
      return wrap;
    },
  },
];

const TURN_RULES = [
  { id: "single", label: "One match", desc: "Turn ends after one pair." },
  { id: "streak", label: "Until you miss", desc: "Keep going until you stall or miss." },
  { id: "timed", label: "Timed", desc: "Everyone gets the same clock." },
];

const DIFFICULTIES = ["easy", "medium", "hard"];

export function renderRoomSetup(root, ctx, params = {}) {
  const local = {
    mode: "shared",
    layoutId: params.layoutId || defaultLayoutForDifficulty("medium", ctx.state.points).id,
    difficulty: params.layoutId ? LAYOUTS[params.layoutId].difficulty === "hard" ? "hard" : LAYOUTS[params.layoutId].difficulty : "medium",
    freeTilesGlow: ctx.state.settings.freeTilesGlow,
    hintsAllowed: true,
    shuffleAllowed: true,
    openPairsAllowed: true,
    undoAllowed: true, // Solo/Live only — forced off for Shared/Race regardless
    suddenDeath: false, // ends the game the instant no pairs are left; forces shuffleAllowed off while on
    openLink: true,
    bots: new Array(BOT_SEAT_COUNT).fill(null), // each slot: null (open) or { name, difficulty }
    pickerSeat: null, // seat index (0-based within bots[]) currently showing the difficulty popover
    livePlayers: [ctx.state.currentUser], // Live only: hot-seat roster in turn order
    turnRule: "single", // Live only
    turnSeconds: 20, // Live only, used when turnRule === "timed"
  };
  let openLinkRow = null;
  let undoRow = null;
  let primaryButton = null;
  let creating = false;

  function renderModeDependentControls() {
    const solo = local.mode === "solo";
    const live = local.mode === "live";
    if (openLinkRow) openLinkRow.style.display = solo || live ? "none" : "flex";
    // Undo is a fairness concern once other people share the board in real
    // time — Solo is the only mode where it's ever a real choice (Live's
    // hot-seat stays always-on, Shared/Race stay always-off; see
    // game/room.js's buildLocalRoom).
    if (undoRow) undoRow.style.display = solo ? "flex" : "none";
    if (primaryButton) primaryButton.textContent = solo || live ? "Create and play" : "Create & invite";
  }

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
      card.addEventListener("click", () => {
        local.mode = m.id;
        renderModes();
        renderPlayers();
        renderLiveSections();
        renderModeDependentControls();
      });
      modeRow.appendChild(card);
    });
  }
  renderModes();
  body.appendChild(modeRow);

  // ---- players (bot seats, Shared/Race only) ----
  const playersSection = el("div");
  playersSection.appendChild(el("div", { class: "section-label", style: "padding:0 0 9px", text: "Players" }));
  const seatRow = el("div", { style: "display:flex;gap:10px" });
  playersSection.appendChild(seatRow);
  playersSection.appendChild(el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.5);margin-top:8px", text: "Bots you don't add stay open for other players to join." }));
  const pickerPanel = el("div", { style: "display:none;margin-top:10px;padding:12px;border-radius:12px;background:rgba(0,0,0,.22);flex-direction:column;gap:8px" });
  playersSection.appendChild(pickerPanel);

  function randomBotName() {
    const used = local.bots.filter(Boolean).map((b) => b.name);
    const available = BOT_NAME_POOL.filter((n) => n !== ctx.state.currentUser && !used.includes(n));
    return available.length ? available[Math.floor(Math.random() * available.length)] : `Bot ${used.length + 1}`;
  }

  function renderPicker() {
    pickerPanel.style.display = local.pickerSeat == null ? "none" : "flex";
    pickerPanel.innerHTML = "";
    if (local.pickerSeat == null) return;
    pickerPanel.appendChild(el("div", { style: "font:600 12px Figtree,sans-serif;color:rgba(246,241,228,.7)", text: "Bot difficulty" }));
    const diffRow = el("div", { style: "display:flex;gap:8px" });
    BOT_DIFFICULTIES.forEach((diff) => {
      const btn = el("button", { class: "btn btn-ghost", style: "flex:1;height:38px;text-transform:capitalize", text: diff });
      btn.addEventListener("click", () => {
        local.bots[local.pickerSeat] = { name: randomBotName(), difficulty: diff };
        local.pickerSeat = null;
        renderPlayers();
      });
      diffRow.appendChild(btn);
    });
    pickerPanel.appendChild(diffRow);
    const cancel = el("button", { style: "background:none;border:none;color:rgba(246,241,228,.5);font:600 12px Figtree,sans-serif;cursor:pointer;align-self:flex-start", text: "Cancel" });
    cancel.addEventListener("click", () => { local.pickerSeat = null; renderPlayers(); });
    pickerPanel.appendChild(cancel);
  }

  function renderPlayers() {
    playersSection.style.display = local.mode === "solo" || local.mode === "live" ? "none" : "";
    if (local.mode === "solo" || local.mode === "live") { local.pickerSeat = null; return; }
    seatRow.innerHTML = "";
    const you = el("div", { style: "display:flex;flex-direction:column;align-items:center;gap:5px" });
    you.appendChild(avatarDot(ctx.state.currentUser, 0, 48, ctx.state.store.users));
    you.appendChild(el("span", { style: "font:600 11px Figtree,sans-serif;color:rgba(246,241,228,.6)", text: "You" }));
    seatRow.appendChild(you);
    local.bots.forEach((bot, i) => {
      const seatIndex = i + 1;
      const seat = el("div", { style: "display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer" });
      if (bot) {
        seat.appendChild(avatarDot(bot.name, seatIndex, 48, ctx.state.store.users));
        seat.appendChild(el("span", { style: "font:600 11px Figtree,sans-serif;color:rgba(246,241,228,.85)", text: bot.name }));
        seat.appendChild(el("span", { style: "font:10px Figtree,sans-serif;color:rgba(246,241,228,.45);text-transform:capitalize;margin-top:-3px", text: bot.difficulty }));
        seat.addEventListener("click", () => { local.bots[i] = null; local.pickerSeat = null; renderPlayers(); });
      } else {
        seat.appendChild(el("div", { style: "width:48px;height:48px;border-radius:50%;border:1.5px dashed rgba(246,241,228,.35);display:flex;align-items:center;justify-content:center;font:300 20px Figtree,sans-serif;color:rgba(246,241,228,.4)", text: "+" }));
        seat.appendChild(el("span", { style: "font:600 11px Figtree,sans-serif;color:rgba(246,241,228,.4)", text: "Open" }));
        seat.addEventListener("click", () => { local.pickerSeat = local.pickerSeat === i ? null : i; renderPlayers(); });
      }
      seatRow.appendChild(seat);
    });
    renderPicker();
  }
  renderPlayers();
  body.appendChild(playersSection);

  // ---- roster (Live only) ----
  const rosterSection = el("div");
  rosterSection.appendChild(el("div", { class: "section-label", style: "padding:0 0 9px", text: "Players" }));
  const rosterList = el("div", { style: "display:flex;flex-direction:column;gap:6px" });
  rosterSection.appendChild(rosterList);
  const addRow = el("div", { style: "display:flex;gap:8px;margin-top:8px" });
  const addInput = el("input", { type: "text", placeholder: "Add a player", style: "flex:1;min-width:0;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#f6f1e4;font:13px Figtree,sans-serif" });
  const addBtn = el("button", { class: "btn btn-ghost", style: "padding:0 16px", text: "Add" });
  function addLivePlayer() {
    const name = addInput.value.trim();
    if (!name) return;
    if (!isActualPlayerName(name)) { ctx.toast("Enter an actual name."); return; }
    if (local.livePlayers.some((p) => p.toLowerCase() === name.toLowerCase())) { ctx.toast("That name is already in the lineup."); return; }
    local.livePlayers.push(name);
    addInput.value = "";
    renderRoster();
  }
  addBtn.addEventListener("click", addLivePlayer);
  addInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addLivePlayer(); } });
  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  rosterSection.appendChild(addRow);
  rosterSection.appendChild(el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.5);margin-top:8px", text: "Players go in this order, then repeat. Use ↑/↓ to reorder." }));

  function renderRoster() {
    rosterList.innerHTML = "";
    local.livePlayers.forEach((name, i) => {
      const first = i === 0;
      const last = i === local.livePlayers.length - 1;
      const onlyTwo = local.livePlayers.length <= 2;
      const row = el("div", { style: "display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.06)" });
      row.appendChild(avatarDot(name, i, 34, ctx.state.store.users));
      row.appendChild(el("div", { style: "flex:1;min-width:0;font:600 13.5px Figtree,sans-serif;color:#f6f1e4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", text: name }));
      const upBtn = el("button", { style: `background:none;border:none;padding:4px;color:${first ? "rgba(246,241,228,.25)" : "rgba(246,241,228,.75)"};cursor:pointer;font-size:14px`, text: "↑" });
      upBtn.addEventListener("click", () => {
        if (first) return;
        [local.livePlayers[i - 1], local.livePlayers[i]] = [local.livePlayers[i], local.livePlayers[i - 1]];
        renderRoster();
      });
      const downBtn = el("button", { style: `background:none;border:none;padding:4px;color:${last ? "rgba(246,241,228,.25)" : "rgba(246,241,228,.75)"};cursor:pointer;font-size:14px`, text: "↓" });
      downBtn.addEventListener("click", () => {
        if (last) return;
        [local.livePlayers[i + 1], local.livePlayers[i]] = [local.livePlayers[i], local.livePlayers[i + 1]];
        renderRoster();
      });
      const removeBtn = el("button", { style: `background:none;border:none;padding:4px;color:${onlyTwo ? "rgba(246,241,228,.25)" : "rgba(246,241,228,.55)"};cursor:pointer;font-size:16px`, text: "×", "aria-label": `Remove ${name}` });
      removeBtn.addEventListener("click", () => {
        if (onlyTwo) { ctx.toast("Live needs at least two players."); return; }
        local.livePlayers.splice(i, 1);
        renderRoster();
      });
      row.appendChild(upBtn);
      row.appendChild(downBtn);
      row.appendChild(removeBtn);
      rosterList.appendChild(row);
    });
  }
  renderRoster();
  body.appendChild(rosterSection);

  // ---- turn rule (Live only) ----
  const turnRuleSection = el("div");
  turnRuleSection.appendChild(el("div", { class: "section-label", style: "padding:0 0 9px", text: "Turn rule" }));
  const turnRuleRow = el("div", { style: "display:flex;gap:8px" });
  turnRuleSection.appendChild(turnRuleRow);
  const turnSecondsRow = el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.06)" });
  turnRuleSection.appendChild(turnSecondsRow);

  function renderTurnRule() {
    turnRuleRow.innerHTML = "";
    TURN_RULES.forEach((r) => {
      const active = r.id === local.turnRule;
      const card = el("div", { style: `flex:1;padding:10px;border-radius:12px;background:${active ? "rgba(217,164,65,.16)" : "rgba(255,255,255,.06)"};border:1.5px solid ${active ? "#d9a441" : "rgba(255,255,255,.1)"};cursor:pointer` });
      card.appendChild(el("div", { style: "font:700 12px Figtree,sans-serif;color:#f6f1e4", text: r.label }));
      card.appendChild(el("div", { style: "font:10.5px/1.3 Figtree,sans-serif;color:rgba(246,241,228,.55);margin-top:3px", text: r.desc }));
      card.addEventListener("click", () => { local.turnRule = r.id; renderTurnRule(); });
      turnRuleRow.appendChild(card);
    });
    turnSecondsRow.style.display = local.turnRule === "timed" ? "flex" : "none";
  }
  function renderTurnSeconds() {
    turnSecondsRow.innerHTML = "";
    turnSecondsRow.appendChild(el("span", { style: "font:600 13px Figtree,sans-serif;color:#f6f1e4", text: "Seconds per turn" }));
    const stepper = el("div", { style: "display:flex;align-items:center;gap:12px" });
    const minusBtn = el("button", { class: "icon-btn", style: "width:32px;height:32px", text: "–", "aria-label": "Fewer seconds" });
    const valueEl = el("span", { style: "font:700 14px Figtree,sans-serif;color:#f6f1e4;min-width:28px;text-align:center", text: String(local.turnSeconds) });
    const plusBtn = el("button", { class: "icon-btn", style: "width:32px;height:32px", text: "+", "aria-label": "More seconds" });
    minusBtn.addEventListener("click", () => { local.turnSeconds = Math.max(10, local.turnSeconds - 5); valueEl.textContent = String(local.turnSeconds); });
    plusBtn.addEventListener("click", () => { local.turnSeconds = Math.min(60, local.turnSeconds + 5); valueEl.textContent = String(local.turnSeconds); });
    stepper.appendChild(minusBtn);
    stepper.appendChild(valueEl);
    stepper.appendChild(plusBtn);
    turnSecondsRow.appendChild(stepper);
  }
  renderTurnRule();
  renderTurnSeconds();
  body.appendChild(turnRuleSection);

  function renderLiveSections() {
    const live = local.mode === "live";
    rosterSection.style.display = live ? "" : "none";
    turnRuleSection.style.display = live ? "" : "none";
  }
  renderLiveSections();

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
        const picked = defaultLayoutForDifficulty(d, ctx.state.points);
        local.layoutId = picked.id;
        if (picked.difficulty !== d) ctx.toast(`No ${d} layouts unlocked yet — using ${picked.name} for now.`);
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
  function toggleRow(label, key, onToggle) {
    const row = el("div", { class: "toggle-row" });
    row.appendChild(el("span", { text: label }));
    const t = el("button", { class: `toggle${local[key] ? " on" : ""}`, type: "button" });
    t.appendChild(el("div", { class: "knob" }));
    t.addEventListener("click", () => {
      if (t.disabled) return;
      local[key] = !local[key];
      t.classList.toggle("on", local[key]);
      onToggle?.(local[key]);
    });
    row.appendChild(t);
    row._toggleBtn = t;
    return row;
  }
  function setToggleDisabled(row, disabled) {
    const btn = row._toggleBtn;
    btn.disabled = disabled;
    row.style.opacity = disabled ? "0.45" : "";
    row.style.pointerEvents = disabled ? "none" : "";
  }
  toggles.appendChild(toggleRow("Free tiles glow", "freeTilesGlow"));
  toggles.appendChild(toggleRow("Hints allowed", "hintsAllowed"));
  const shuffleRow = toggleRow("Allow shuffle", "shuffleAllowed");
  toggles.appendChild(shuffleRow);
  toggles.appendChild(toggleRow("Show open pairs", "openPairsAllowed"));
  undoRow = toggleRow("Allow undo", "undoAllowed");
  toggles.appendChild(undoRow);
  // Sudden death ends the game the instant no pairs are left to match —
  // Shuffle exists to rescue exactly that situation, so the two can't both
  // be on. Turning Sudden death on forces Shuffle off and locks it; turning
  // it back off just unlocks Shuffle (doesn't re-enable it on its own).
  const suddenDeathRow = toggleRow("Sudden death", "suddenDeath", (on) => {
    if (on) {
      local.shuffleAllowed = false;
      shuffleRow._toggleBtn.classList.remove("on");
    }
    setToggleDisabled(shuffleRow, on);
  });
  toggles.appendChild(suddenDeathRow);
  setToggleDisabled(shuffleRow, local.suddenDeath);
  openLinkRow = toggleRow("Open to anyone with the link", "openLink");
  toggles.appendChild(openLinkRow);
  body.appendChild(toggles);

  root.appendChild(el("div", { style: "flex:1" }));

  const footer = el("div", { style: "padding:14px 16px 30px" });
  primaryButton = el("button", {
    class: "btn btn-primary btn-lg", style: "width:100%", text: "Create & invite",
    onClick: async () => {
      if (creating) return;
      creating = true;
      primaryButton.disabled = true;
      primaryButton.setAttribute("aria-busy", "true");
      primaryButton.textContent = "Creating…";
      try {
        const layout = LAYOUTS[local.layoutId];
        const live = local.mode === "live";
        // Shared boards can pile up several of the same layout in open
        // rooms/invites at once — prefix with the host's name so they're
        // distinguishable at a glance instead of all reading "Dragon's Nest".
        const title = local.mode === "shared" ? `${ctx.state.currentUser}'s ${layout.name}` : layout.name;
        const room = buildLocalRoom({
          title,
          mode: local.mode,
          layoutId: local.layoutId,
          difficulty: local.difficulty,
          visibility: local.mode === "solo" || live ? "private" : local.openLink ? "open" : "private",
          createdBy: ctx.state.currentUser,
          freeTilesGlow: local.freeTilesGlow,
          hintsAllowed: local.hintsAllowed,
          shuffleAllowed: local.shuffleAllowed,
          openPairsAllowed: local.openPairsAllowed,
          undoAllowed: local.undoAllowed,
          suddenDeath: local.suddenDeath,
          bots: local.bots.filter(Boolean),
          players: live ? local.livePlayers : undefined,
          turnRule: live ? local.turnRule : undefined,
          turnSeconds: live ? local.turnSeconds : undefined,
        });
        // Live is hot-seat play on this one device — no server room, no
        // mid-game network traffic. Local play/ranking already works fully
        // offline (same fallback solo/shared use when the Worker is
        // unreachable), so this just skips the round-trip outright.
        if (!live && ctx.api.configured()) {
          try {
            const result = await ctx.api.createRoom({ title: room.title, mode: room.mode, layoutId: room.layoutId, difficulty: room.difficulty, visibility: room.visibility, createdBy: room.createdBy, freeTilesGlow: room.freeTilesGlow, hintsAllowed: room.hintsAllowed, shuffleAllowed: room.shuffleAllowed, openPairsAllowed: room.openPairsAllowed, undoAllowed: room.undoAllowed, suddenDeath: room.suddenDeath, bots: local.bots.filter(Boolean) });
            // Keep the local board/bot setup, but use the persisted room id so
            // the completion snapshot updates the same D1 record.
            room.id = result.room.id;
          } catch {
            // Offline rooms still play and rank locally. Hydration now keeps
            // their completed snapshots instead of discarding them.
          }
        }
        ctx.state.store.rooms[room.id] = room;
        ctx.state.activeRoomId = room.id;
        ctx.persist();
        ctx.navigate(room.mode === "solo" || live ? "board" : "invite", { roomId: room.id });
      } catch {
        ctx.toast("Couldn't create that room. Please try again.");
      } finally {
        creating = false;
        if (primaryButton.isConnected) {
          primaryButton.disabled = false;
          primaryButton.removeAttribute("aria-busy");
          renderModeDependentControls();
        }
      }
    },
  });
  footer.appendChild(primaryButton);
  renderModeDependentControls();
  root.appendChild(footer);
}
