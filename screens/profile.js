// Matched — You / Profile. Tier bar above stats, "Your table" equips,
// "This month" stats, settings flattened onto the screen. See
// design-reference.html #1l.

import { el, avatarDot } from "./shared-ui.js";
import { tierForPoints, nextTier, pointsToNextTier, TIER_UNLOCKS, TIERS, nextCosmeticUnlock, cosmeticUnlockEvents } from "../game/scoring.js";

const ICON_SWITCH_PLAYER = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>`;

const FELT_SWATCHES = {
  Wood: "background:radial-gradient(120% 120% at 40% 20%,#20694e,#0e3527)",
  Stone: "background:radial-gradient(120% 120% at 40% 20%,#454b4d,#1c2021)",
  Resin: "background:radial-gradient(120% 120% at 40% 20%,#2f6b57,#123128)",
  Bamboo: "background:radial-gradient(120% 120% at 40% 20%,#4d6b28,#233312)",
  Bone: "background:radial-gradient(120% 120% at 40% 20%,#0f4a38,#072019)",
  Porcelain: "background:radial-gradient(120% 120% at 40% 20%,#1f3f6e,#0c1b30)",
  Rosewood: "background:radial-gradient(120% 120% at 40% 20%,#5a3822,#2a1a0f)",
  Jade: "background:radial-gradient(120% 120% at 40% 20%,#1f6b4e,#0c2b1f)",
  Cloisonné: "background:radial-gradient(120% 120% at 40% 20%,#173a5c,#081a2b)",
  Lacquer: "background:radial-gradient(120% 120% at 40% 20%,#241a17,#0a0706)",
};
// Textures per the material brief: rough-sawn timber / aggregate stone /
// molded resin / carved bamboo / aged bone / cobalt porcelain / brass-
// inlaid rosewood / quiet jade / enamel-and-brass cloisonné / lacquer with
// mother-of-pearl, gold, and burgundy.
const MATERIAL_SWATCHES = {
  Wood: "background:linear-gradient(160deg,#c9a06b,#8a6239);box-shadow:2px 3px 0 #5c4023",
  Stone: "background:linear-gradient(160deg,#c9c9c4,#94938c);box-shadow:2px 3px 0 #5c5b55",
  Resin: "background:linear-gradient(160deg,#eef1ea,#cfd6c7);box-shadow:2px 3px 0 #96a08a",
  Bamboo: "background:linear-gradient(160deg,#dcd08c,#a89751);box-shadow:2px 3px 0 #7c6c31",
  Bone: "background:linear-gradient(160deg,#f7f2e4,#e9e0cb);box-shadow:2px 3px 0 #b3a582",
  Porcelain: "background:linear-gradient(160deg,#f5f7fb,#dbe4f2);box-shadow:2px 3px 0 #2b5f9e",
  Rosewood: "background:linear-gradient(160deg,#8b4a3d,#5c2c22);box-shadow:2px 3px 0 #caa14a",
  Jade: "background:linear-gradient(160deg,#cfe6da,#9dc4b1);box-shadow:2px 3px 0 #6d9482",
  Cloisonné: "background:linear-gradient(160deg,#2b5f9e,#1a3c66);box-shadow:2px 3px 0 #d9a441",
  Lacquer: "background:linear-gradient(160deg,#3a1418,#0d0607);box-shadow:2px 3px 0 #d9a441",
};

// Felt and tile material used to share one threshold per tier; now each
// has its own (see TIER_UNLOCKS.feltThreshold/materialThreshold in
// scoring.js), so "unlocked" has to be checked per cosmetic type, not per
// tier as a whole.
function cosmeticUnlocked(key, tierName, points) {
  const u = TIER_UNLOCKS[tierName];
  return points >= (key === "felt" ? u.feltThreshold : u.materialThreshold);
}

// Resolves what's actually equipped: the user's saved choice if it's still
// unlocked, otherwise falls back to the current tier's default.
function equippedTierName(ctx, key, currentTierName) {
  const stored = ctx.state.equipped?.[key];
  if (stored && cosmeticUnlocked(key, stored, ctx.state.points)) return stored;
  return currentTierName;
}

// A 2-up grid of tier-gated cosmetic options (felt or tile material): the
// unlocked ones are tappable to equip, locked ones show a padlock and what
// it takes to unlock, mirroring the locked-layout-card convention in
// design-reference.html.
function cosmeticGrid(ctx, { key, swatches, nameFor, subFor }, currentTierName, rerender) {
  const grid = el("div", { style: "padding:8px 16px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px" });
  const equippedName = equippedTierName(ctx, key, currentTierName);
  for (const tier of TIERS) {
    const threshold = key === "felt" ? TIER_UNLOCKS[tier.name].feltThreshold : TIER_UNLOCKS[tier.name].materialThreshold;
    const unlocked = ctx.state.points >= threshold;
    const isEquipped = unlocked && equippedName === tier.name;
    const cell = el("div", {
      style: `position:relative;padding:12px;border-radius:13px;background:rgba(255,255,255,.06);display:flex;align-items:center;gap:10px;border:1.5px solid ${isEquipped ? "var(--gold)" : "transparent"};${unlocked ? "cursor:pointer" : ""}`,
    });
    cell.appendChild(el("div", { style: `width:26px;height:34px;border-radius:5px;${swatches[tier.name]}${unlocked ? "" : ";opacity:.4"}` }));
    const info = el("div", { style: "flex:1;min-width:0" });
    info.appendChild(el("div", { style: `font:600 13px Figtree,sans-serif;color:${unlocked ? "#f6f1e4" : "rgba(246,241,228,.55)"}`, text: nameFor(tier) }));
    info.appendChild(el("div", { style: "font:10.5px Figtree,sans-serif;color:rgba(246,241,228,.5)", text: unlocked ? (isEquipped ? "Equipped" : subFor(tier)) : `Unlocks at ${threshold.toLocaleString()} pts` }));
    cell.appendChild(info);
    if (!unlocked) {
      cell.appendChild(el("div", { style: "position:absolute;top:10px;right:10px;font-size:14px;opacity:.7", text: "🔒" }));
    } else {
      cell.addEventListener("click", () => {
        ctx.state.equipped = ctx.state.equipped || {};
        ctx.state.equipped[key] = tier.name;
        ctx.persist();
        rerender();
      });
    }
    grid.appendChild(cell);
  }
  return grid;
}

function monthStats(rooms, user) {
  const since = Date.now() - 30 * 24 * 3600 * 1000;
  let boards = 0, pairs = 0, timeS = 0, longestStreak = 0;
  for (const room of Object.values(rooms)) {
    if (!room.completedAt || Date.parse(room.completedAt) < since) continue;
    if (!room.players.includes(user)) continue;
    boards += 1;
    pairs += room.pairsCleared[user] || 0;
    if (room.startedAt) timeS += Math.max(1, Math.round((Date.parse(room.completedAt) - room.startedAt) / 1000));
    longestStreak = Math.max(longestStreak, (room.peakStreaks && room.peakStreaks[user]) || room.streaks[user] || 0);
  }
  return { boards, pairs, avgTimeS: boards ? Math.round(timeS / boards) : 0, longestStreak };
}

export function renderProfile(root, ctx) {
  const rerender = () => renderProfile(root, ctx);
  root.innerHTML = "";
  const user = ctx.state.currentUser;
  const tier = tierForPoints(ctx.state.points);
  const next = nextTier(ctx.state.points);
  const toNext = pointsToNextTier(ctx.state.points);
  const tierIdx = TIERS.findIndex((t) => t.name === tier.name);
  const spanStart = TIERS[tierIdx].threshold;
  const spanEnd = next ? next.threshold : spanStart + 1;
  const progressPct = next ? Math.min(100, Math.round(((ctx.state.points - spanStart) / (spanEnd - spanStart)) * 100)) : 100;
  // Felt and tile material no longer share a threshold within a tier (see
  // scoring.js), so "what unlocks next" has to walk both tracks together
  // rather than just peeking at the next tier's bundle.
  const nextUnlock1 = nextCosmeticUnlock(ctx.state.points);
  const nextUnlock2 = nextUnlock1 ? cosmeticUnlockEvents().find((e) => e.threshold > nextUnlock1.threshold) || null : null;

  const header = el("div", { style: "padding:8px 20px 16px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px" });
  const headerLeft = el("div", { style: "display:flex;align-items:center;gap:14px;min-width:0" });
  headerLeft.appendChild(avatarDot(user, 0, 62));
  const nameWrap = el("div");
  nameWrap.appendChild(el("div", { class: "title-serif", style: "font-size:26px", text: user }));
  nameWrap.appendChild(el("div", { style: "font:12.5px Figtree,sans-serif;color:rgba(246,241,228,.55);margin-top:5px", text: `${tier.name} tier · ${ctx.state.points.toLocaleString()} points` }));
  headerLeft.appendChild(nameWrap);
  header.appendChild(headerLeft);

  // Compact switch-player entry, tucked top-right so it doesn't compete
  // with the profile content below for attention (a full-width card here
  // felt obstructive) — still a one-tap escape if you're on the wrong
  // profile, just not the first thing the screen shows you.
  const switchBtn = el("button", {
    class: "icon-btn", style: "flex:none", html: ICON_SWITCH_PLAYER, "aria-label": "Switch player",
    onClick: () => ctx.navigate("name-entry"),
  });
  header.appendChild(switchBtn);
  root.appendChild(header);

  const tierCard = el("div", { style: "margin:0 16px 16px;padding:15px;border-radius:16px;background:linear-gradient(150deg,rgba(95,191,155,.2),rgba(255,255,255,.05));border:1px solid rgba(95,191,155,.3)" });
  const tierHead = el("div", { style: "display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px" });
  tierHead.appendChild(el("span", { style: "font:700 13px Figtree,sans-serif;color:#f6f1e4", text: tier.name }));
  tierHead.appendChild(el("span", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.6)", text: next ? `${toNext.toLocaleString()} to ${next.name}` : "Top tier reached" }));
  tierCard.appendChild(tierHead);
  tierCard.appendChild(el("div", { style: "height:8px;border-radius:4px;background:rgba(0,0,0,.28);overflow:hidden", html: `<div style="width:${progressPct}%;height:100%;background:linear-gradient(90deg,#5fbf9b,#d9a441);border-radius:4px"></div>` }));
  const unlocksRow = el("div", { style: "display:flex;gap:10px;margin-top:13px" });
  const unlockCell = (title, sub) => {
    const cell = el("div", { style: "flex:1;padding:9px;border-radius:11px;background:rgba(0,0,0,.2);text-align:center" });
    cell.appendChild(el("div", { style: "font:700 15px Figtree,sans-serif;color:#f6f1e4", text: title }));
    cell.appendChild(el("div", { style: "font:10px Figtree,sans-serif;color:rgba(246,241,228,.5);margin-top:2px", text: sub }));
    return cell;
  };
  if (nextUnlock1) {
    unlocksRow.appendChild(unlockCell(nextUnlock1.label, `Next · ${nextUnlock1.kind === "felt" ? "Table" : "Tiles"}`));
    unlocksRow.appendChild(nextUnlock2
      ? unlockCell(nextUnlock2.label, `Then · ${nextUnlock2.kind === "felt" ? "Table" : "Tiles"}`)
      : unlockCell("—", "Then"));
  } else {
    const equippedFelt = equippedTierName(ctx, "felt", tier.name);
    const equippedMaterial = equippedTierName(ctx, "material", tier.name);
    unlocksRow.appendChild(unlockCell(TIER_UNLOCKS[equippedFelt].felt, "Equipped felt"));
    unlocksRow.appendChild(unlockCell(TIERS.find((t) => t.name === equippedMaterial).material, "Equipped material"));
  }
  tierCard.appendChild(unlocksRow);
  root.appendChild(tierCard);

  root.appendChild(el("div", { class: "section-label", style: "padding:0 16px 6px", text: "Your table" }));
  root.appendChild(cosmeticGrid(ctx, {
    key: "felt",
    swatches: FELT_SWATCHES,
    nameFor: (t) => TIER_UNLOCKS[t.name].felt,
    subFor: () => "Table",
  }, tier.name, rerender));

  root.appendChild(el("div", { class: "section-label", style: "padding:0 16px 6px", text: "Your tiles" }));
  root.appendChild(cosmeticGrid(ctx, {
    key: "material",
    swatches: MATERIAL_SWATCHES,
    nameFor: (t) => t.material,
    subFor: () => "Tiles",
  }, tier.name, rerender));

  root.appendChild(el("div", { class: "section-label", style: "padding:0 16px 6px", text: "This month" }));
  const stats = monthStats(ctx.state.store.rooms || {}, user);
  const statGrid = el("div", { style: "padding:8px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px" });
  const statCell = (value, label) => {
    const cell = el("div", { style: "padding:13px;border-radius:13px;background:rgba(255,255,255,.06)" });
    cell.appendChild(el("div", { style: "font:700 22px Figtree,sans-serif;color:#f6f1e4", text: String(value) }));
    cell.appendChild(el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.5);margin-top:3px", text: label }));
    return cell;
  };
  statGrid.appendChild(statCell(stats.boards, "Boards cleared"));
  statGrid.appendChild(statCell(stats.pairs, "Pairs cleared"));
  const avgM = Math.floor(stats.avgTimeS / 60), avgS = stats.avgTimeS % 60;
  statGrid.appendChild(statCell(stats.boards ? `${avgM}:${String(avgS).padStart(2, "0")}` : "—", "Average time"));
  statGrid.appendChild(statCell(stats.longestStreak, "Longest streak"));
  root.appendChild(statGrid);

  root.appendChild(el("div", { class: "section-label", style: "padding-top:8px", text: "Settings" }));
  const settingsCard = el("div", { style: "margin:0 16px 16px;display:flex;flex-direction:column;gap:1px;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.07)" });
  const toggleRow = (label, key) => {
    const row = el("div", { class: "toggle-row" });
    row.appendChild(el("span", { text: label }));
    const t = el("button", { class: `toggle${ctx.state.settings[key] ? " on" : ""}`, type: "button" });
    t.appendChild(el("div", { class: "knob" }));
    t.addEventListener("click", () => {
      ctx.state.settings[key] = !ctx.state.settings[key];
      t.classList.toggle("on", ctx.state.settings[key]);
      ctx.persist();
    });
    row.appendChild(t);
    return row;
  };
  settingsCard.appendChild(toggleRow("Free tiles glow", "freeTilesGlow"));
  settingsCard.appendChild(toggleRow("Hints allowed", "hintsAllowed"));
  settingsCard.appendChild(toggleRow("Sound", "sound"));
  settingsCard.appendChild(toggleRow("Haptics", "haptic"));
  root.appendChild(settingsCard);

  const manageRow = el("button", { class: "row-link", type: "button", text: "Manage players", onClick: () => ctx.navigate("manage-players") });
  root.appendChild(manageRow);

  root.appendChild(el("div", { style: "flex:1" }));
}
