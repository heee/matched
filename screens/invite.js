// Matched — Invite sheet. Copyable link, recent people as one-tap invite
// chips, "Share invite" hands off to the OS share sheet. See
// docs/design-reference.html #1n.

import { el, avatarDot, roomInviteUrl } from "./shared-ui.js";

const RECENT_PEOPLE = ["Dana", "Mika", "Jules", "Robin"];

export function renderInvite(root, ctx, params = {}) {
  const room = ctx.state.store.rooms[params.roomId];
  if (!room) { ctx.navigate("home"); return; }
  const link = roomInviteUrl(room.id);

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
      sheet.appendChild(el("div", { style: "font:13.5px/1.5 Figtree,sans-serif;color:rgba(246,241,228,.6);margin-top:7px", text: "Anyone with the link joins instantly. No account, no download prompt until they finish a board." }));

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

      const invitees = el("div", { style: "display:flex;gap:9px;margin-top:12px" });
      RECENT_PEOPLE.forEach((name, i) => {
        const chip = el("div", { style: "flex:1;padding:11px 6px;border-radius:13px;background:rgba(255,255,255,.06);display:flex;flex-direction:column;align-items:center;gap:6px" });
        chip.appendChild(avatarDot(name, i + 1, 32));
        chip.appendChild(el("div", { style: "font:600 11px Figtree,sans-serif;color:rgba(246,241,228,.7)", text: name }));
        invitees.appendChild(chip);
      });
      sheet.appendChild(invitees);

      const shareBtn = el("button", { class: "btn btn-primary btn-lg", style: "width:100%;margin-top:16px", text: "Share invite" });
      shareBtn.addEventListener("click", async () => {
        const shareData = { title: room.title, text: `${ctx.state.currentUser} invited you to ${room.title}`, url: link };
        if (navigator.share) {
          try { await navigator.share(shareData); } catch (e) {}
        } else {
          navigator.clipboard?.writeText(shareData.url).catch(() => {});
          ctx.toast("Link copied");
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
