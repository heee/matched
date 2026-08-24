// Matched — Invite sheet. A seat grid shows bots already picked in room-setup
// plus open seats you can invite a registered user into. "Share invite"
// hands off to the OS share sheet. See
// docs/design-reference.html #1n.

import { el, avatarDot, roomInviteUrl } from "./shared-ui.js";
import { newBoardShareMessage } from "../game/share-messages.js";
import { inviteSeatEntries } from "../game/invite-seats.js";

const TOTAL_SEATS = 4; // you + up to 3 others, matching room-setup's bot-seat count

// Stroke-only action icons, following the app's Lucide-style icon convention.
const ICON_SHARE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>`;
const ICON_ENTER = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;

function sendInvite(ctx, room, toUser) {
  ctx.state.store.invites = ctx.state.store.invites || [];
  ctx.state.store.invites.push({
    id: `${room.id}-${toUser}-${Date.now().toString(36)}`,
    roomId: room.id,
    roomTitle: room.title,
    toUser,
    fromUser: ctx.state.currentUser,
    createdAt: new Date().toISOString(),
    notified: false,
  });
  ctx.persist();
}

export function renderInvite(root, ctx, params = {}) {
  let room = ctx.state.store.rooms[params.roomId];
  if (!room) { ctx.navigate("home"); return; }
  const link = roomInviteUrl(room.id);
  const isHost = room.createdBy === ctx.state.currentUser;
  let pickerSeat = null; // which open seat index currently shows the invite picker
  let refreshInFlight = false;
  let renderSeats = null;
  let renderActions = null;

  async function refreshJoinedPlayers() {
    if (refreshInFlight || !root.isConnected) return;
    refreshInFlight = true;
    try {
      const freshRoom = await ctx.refreshRoom(room.id);
      if (!freshRoom || !root.isConnected) return;
      const justStarted = !room.gameStarted && freshRoom.gameStarted;
      room = freshRoom;
      renderSeats?.();
      renderActions?.();
      // The host started the game while we were waiting here — follow them
      // straight into the board instead of making the guest tap "Enter".
      if (justStarted && !isHost) {
        ctx.navigate(room.mode === "race" ? "race-board" : "board", { roomId: room.id });
      }
    } catch {
      // Keep the locally cached seats usable while offline; the next tick,
      // focus event, or visit to this screen will try again.
    } finally {
      refreshInFlight = false;
    }
  }

  root.appendChild(el("div", { class: "bg-flat", style: "flex:1;display:flex;flex-direction:column" }, [
    (() => {
      const backdrop = el("div", { style: "opacity:.32;padding:0 16px;padding-top:58px" });
      backdrop.appendChild(el("div", { class: "title-serif", style: "padding:6px 4px 16px", text: room.title }));
      backdrop.appendChild(el("div", { style: "height:180px;border-radius:16px;background:radial-gradient(120% 120% at 50% 30%,#1d6349,#0e3527)" }));
      return backdrop;
    })(),
    (() => {
      const sheet = el("div", { class: "sheet", style: "margin-top:auto" });
      sheet.appendChild(el("div", { class: "sheet-handle" }));
      sheet.appendChild(el("div", { class: "title-serif", style: "font-size:26px", text: "Bring your people" }));
      const helperText = room.mode === "shared"
        ? (isHost ? "Anyone with the link can jump in and wait here. Start the game once your people are in." : "Anyone with the link can jump in. The host starts the game once everyone's ready.")
        : "Anyone with the link can jump in. Their seat is claimed when they clear their first pair.";
      sheet.appendChild(el("div", { style: "font:13.5px/1.5 Figtree,sans-serif;color:rgba(246,241,228,.6);margin-top:7px", text: helperText }));

      // Solo rooms have nobody to bring in — skip the seat grid entirely.
      if (room.mode !== "solo") {
        const seatSection = el("div", { style: "margin-top:16px" });
        const seatRow = el("div", { style: "display:flex;gap:9px" });
        const pickerPanel = el("div", { style: "display:none;margin-top:10px;padding:12px;border-radius:12px;background:rgba(255,255,255,.06);flex-direction:column;gap:6px;max-height:180px;overflow-y:auto" });
        seatSection.appendChild(seatRow);
        seatSection.appendChild(pickerPanel);
        sheet.appendChild(seatSection);

        function invitedNamesForRoom() {
          return (ctx.state.store.invites || []).filter((inv) => inv.roomId === room.id).map((inv) => inv.toUser);
        }

        function renderPicker() {
          pickerPanel.style.display = pickerSeat == null ? "none" : "flex";
          pickerPanel.innerHTML = "";
          if (pickerSeat == null) return;
          const taken = new Set([...room.players, ...invitedNamesForRoom()]);
          const candidates = Object.keys(ctx.state.store.users || {}).filter((name) => !taken.has(name));
          if (candidates.length === 0) {
            pickerPanel.appendChild(el("div", { style: "font:12.5px Figtree,sans-serif;color:rgba(246,241,228,.5);padding:6px 2px", text: "No other registered players to invite yet." }));
          }
          candidates.forEach((name) => {
            const row = el("button", { style: "display:flex;align-items:center;gap:10px;padding:8px;border-radius:9px;background:none;border:none;cursor:pointer;text-align:left" });
            row.appendChild(avatarDot(name, 1, 28));
            row.appendChild(el("span", { style: "font:600 13px Figtree,sans-serif;color:#f6f1e4", text: name }));
            row.addEventListener("click", () => {
              sendInvite(ctx, room, name);
              pickerSeat = null;
              renderSeats();
            });
            pickerPanel.appendChild(row);
          });
          const cancel = el("button", { style: "background:none;border:none;color:rgba(246,241,228,.5);font:600 12px Figtree,sans-serif;cursor:pointer;text-align:left;padding:6px 2px", text: "Cancel" });
          cancel.addEventListener("click", () => { pickerSeat = null; renderPicker(); });
          pickerPanel.appendChild(cancel);
        }

        renderSeats = function renderSeats() {
          seatRow.innerHTML = "";
          const you = el("div", { style: "flex:1;padding:11px 6px;border-radius:13px;background:rgba(255,255,255,.06);display:flex;flex-direction:column;align-items:center;gap:6px" });
          you.appendChild(avatarDot(ctx.state.currentUser, 0, 32));
          you.appendChild(el("div", { style: "font:600 11px Figtree,sans-serif;color:rgba(246,241,228,.7)", text: "You" }));
          seatRow.appendChild(you);

          const entries = inviteSeatEntries(room, ctx.state.currentUser, invitedNamesForRoom(), TOTAL_SEATS - 1);
          const otherSeats = TOTAL_SEATS - 1;
          for (let i = 0; i < otherSeats; i++) {
            const entry = entries[i];
            if (entry?.kind === "bot" || entry?.kind === "joined") {
              const name = entry.name;
              const chip = el("div", { style: "flex:1;padding:11px 6px;border-radius:13px;background:rgba(255,255,255,.06);display:flex;flex-direction:column;align-items:center;gap:6px" });
              chip.appendChild(avatarDot(name, Math.max(room.players.indexOf(name), i + 1), 32));
              chip.appendChild(el("div", { style: "font:600 11px Figtree,sans-serif;color:rgba(246,241,228,.7)", text: name }));
              chip.appendChild(el("div", {
                style: "font:9.5px Figtree,sans-serif;color:rgba(246,241,228,.4);text-transform:capitalize",
                text: entry.kind === "bot" ? `Bot · ${entry.difficulty}` : "Joined",
              }));
              seatRow.appendChild(chip);
            } else if (entry?.kind === "invited") {
              const name = entry.name;
              const chip = el("div", { style: "flex:1;padding:11px 6px;border-radius:13px;background:rgba(217,164,65,.1);border:1px dashed rgba(217,164,65,.4);display:flex;flex-direction:column;align-items:center;gap:6px" });
              chip.appendChild(avatarDot(name, i + 1, 32));
              chip.appendChild(el("div", { style: "font:600 11px Figtree,sans-serif;color:#e8c887", text: name }));
              chip.appendChild(el("div", { style: "font:9.5px Figtree,sans-serif;color:rgba(232,200,135,.7)", text: "Invited" }));
              seatRow.appendChild(chip);
            } else {
              const chip = el("div", { style: "flex:1;padding:11px 6px;border-radius:13px;background:rgba(255,255,255,.04);border:1.5px dashed rgba(246,241,228,.3);display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer" });
              chip.appendChild(el("div", { style: "width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:300 18px Figtree,sans-serif;color:rgba(246,241,228,.45)", text: "+" }));
              chip.appendChild(el("div", { style: "font:600 11px Figtree,sans-serif;color:rgba(246,241,228,.45)", text: "Invite" }));
              chip.addEventListener("click", () => { pickerSeat = pickerSeat === i ? null : i; renderPicker(); });
              seatRow.appendChild(chip);
            }
          }
          renderPicker();
        };
        renderSeats();
        ctx.refreshUsers().then(() => {
          if (root.isConnected) renderSeats();
        }).catch(() => {});
        refreshJoinedPlayers();
      }

      const actionRow = el("div", { style: "display:flex;gap:10px;margin-top:16px" });
      const shareBtn = el("button", {
        class: "btn btn-primary btn-lg",
        style: "flex:1;min-width:0;gap:8px",
        html: `${ICON_SHARE}<span>Share invite</span>`,
      });
      shareBtn.addEventListener("click", async () => {
        const message = newBoardShareMessage({
          inviter: ctx.state.currentUser,
          title: room.title,
          mode: room.mode,
          tileCount: room.tileCount,
        });
        const shareData = { title: room.title, text: message, url: link };
        if (navigator.share) {
          try { await navigator.share(shareData); } catch (e) {}
        } else {
          navigator.clipboard?.writeText(`${message} ${link}`).catch(() => {});
          ctx.toast("Invite copied");
        }
      });
      actionRow.appendChild(shareBtn);

      const secondSlot = el("div", { style: "flex:1;min-width:0" });
      actionRow.appendChild(secondSlot);
      sheet.appendChild(actionRow);

      function goToBoard() {
        ctx.navigate(room.mode === "race" ? "race-board" : "board", { roomId: room.id });
      }

      function startGame() {
        room.gameStarted = true;
        ctx.reportRoomProgress(room);
        goToBoard();
      }

      renderActions = function renderActions() {
        secondSlot.innerHTML = "";
        const lobbyGated = room.mode === "shared" && !room.gameStarted;
        if (lobbyGated && isHost) {
          const startBtn = el("button", {
            class: "btn btn-primary btn-lg",
            style: "width:100%;gap:8px",
            html: `${ICON_PLAY}<span>Start game</span>`,
          });
          startBtn.addEventListener("click", startGame);
          secondSlot.appendChild(startBtn);
        } else if (lobbyGated) {
          secondSlot.appendChild(el("div", {
            style: "width:100%;height:100%;min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:12px;background:rgba(255,255,255,.05);font:600 12.5px Figtree,sans-serif;color:rgba(246,241,228,.55)",
            text: `Waiting for ${room.createdBy} to start…`,
          }));
        } else {
          const enterBtn = el("button", {
            class: "btn btn-outline btn-lg",
            style: "width:100%;gap:8px",
            html: `${ICON_ENTER}<span>Enter room</span>`,
          });
          enterBtn.addEventListener("click", goToBoard);
          secondSlot.appendChild(enterBtn);
        }
      };
      renderActions();

      return sheet;
    })(),
  ]));

  const refreshTimer = window.setInterval(refreshJoinedPlayers, 5000);
  const refreshWhenVisible = () => {
    if (document.visibilityState === "visible") refreshJoinedPlayers();
  };
  document.addEventListener("visibilitychange", refreshWhenVisible);
  window.__matchedCleanup = () => {
    window.clearInterval(refreshTimer);
    document.removeEventListener("visibilitychange", refreshWhenVisible);
  };
}
