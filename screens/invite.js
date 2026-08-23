// Matched — Invite sheet. Copyable link, a seat grid showing bots already
// picked in room-setup plus open seats you can invite a registered user
// into, "Share invite" hands off to the OS share sheet. See
// docs/design-reference.html #1n.

import { el, avatarDot, roomInviteUrl } from "./shared-ui.js";
import { newBoardShareMessage } from "../game/share-messages.js";

const TOTAL_SEATS = 4; // you + up to 3 others, matching room-setup's bot-seat count

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
  const room = ctx.state.store.rooms[params.roomId];
  if (!room) { ctx.navigate("home"); return; }
  const link = roomInviteUrl(room.id);
  let pickerSeat = null; // which open seat index currently shows the invite picker

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
      sheet.appendChild(el("div", { style: "font:13.5px/1.5 Figtree,sans-serif;color:rgba(246,241,228,.6);margin-top:7px", text: "Anyone with the link can jump in. Their seat is claimed when they clear their first pair." }));

      const copyRow = el("div", { class: "link-copy", style: "margin-top:16px" });
      copyRow.appendChild(el("code", { text: link }));
      const copyBtn = el("button", { text: "Copy" });
      copyBtn.addEventListener("click", () => {
        navigator.clipboard?.writeText(link).catch(() => {});
        copyBtn.textContent = "Copied";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1400);
      });
      copyRow.appendChild(copyBtn);
      sheet.appendChild(copyRow);

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

        function renderSeats() {
          seatRow.innerHTML = "";
          const you = el("div", { style: "flex:1;padding:11px 6px;border-radius:13px;background:rgba(255,255,255,.06);display:flex;flex-direction:column;align-items:center;gap:6px" });
          you.appendChild(avatarDot(ctx.state.currentUser, 0, 32));
          you.appendChild(el("div", { style: "font:600 11px Figtree,sans-serif;color:rgba(246,241,228,.7)", text: "You" }));
          seatRow.appendChild(you);

          const botNames = room.botNames || [];
          const invited = invitedNamesForRoom();
          const otherSeats = TOTAL_SEATS - 1;
          for (let i = 0; i < otherSeats; i++) {
            if (i < botNames.length) {
              const name = botNames[i];
              const chip = el("div", { style: "flex:1;padding:11px 6px;border-radius:13px;background:rgba(255,255,255,.06);display:flex;flex-direction:column;align-items:center;gap:6px" });
              chip.appendChild(avatarDot(name, i + 1, 32));
              chip.appendChild(el("div", { style: "font:600 11px Figtree,sans-serif;color:rgba(246,241,228,.7)", text: name }));
              chip.appendChild(el("div", { style: "font:9.5px Figtree,sans-serif;color:rgba(246,241,228,.4);text-transform:capitalize", text: `Bot · ${(room.botDifficulty && room.botDifficulty[name]) || "medium"}` }));
              seatRow.appendChild(chip);
            } else if (i - botNames.length < invited.length) {
              const name = invited[i - botNames.length];
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
        }
        renderSeats();
        ctx.refreshUsers().then(() => {
          if (root.isConnected) renderSeats();
        }).catch(() => {});
      }

      const shareBtn = el("button", { class: "btn btn-primary btn-lg", style: "width:100%;margin-top:16px", text: "Share invite" });
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
      sheet.appendChild(shareBtn);

      const enterBtn = el("button", { class: "btn btn-outline btn-lg", style: "width:100%;margin-top:10px", text: "Enter room" });
      enterBtn.addEventListener("click", () => ctx.navigate(room.mode === "race" ? "race-board" : "board", { roomId: room.id }));
      sheet.appendChild(enterBtn);

      return sheet;
    })(),
  ]));
}
