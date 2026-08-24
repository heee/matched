// Matched — Manage players. Lists every profile saved on this device with
// a delete affordance per row (confirmation required, current profile is
// protected). Reached from Profile's "Manage players" row.

import { el, avatarDot, confirmDialog } from "./shared-ui.js";

export function renderManagePlayers(root, ctx) {
  const rerender = () => renderManagePlayers(root, ctx);
  root.innerHTML = "";

  const header = el("div", { class: "screen-header" });
  header.appendChild(el("button", { class: "icon-btn", text: "‹", onClick: () => ctx.navigate("profile") }));
  header.appendChild(el("div", { class: "title-serif", style: "font-size:22px", text: "Manage players" }));
  header.appendChild(el("div", { style: "width:34px" })); // balances the back button so the title stays centered
  root.appendChild(header);

  root.appendChild(el("div", { style: "padding:0 20px 14px;font:13px/1.5 Figtree,sans-serif;color:rgba(246,241,228,.6)", text: "Deleting a profile removes it everywhere it's shared, not just this device. Room and ranking history stays intact." }));

  const list = el("div", { class: "row-list" });
  root.appendChild(list);

  const users = ctx.state.store.users || {};
  const names = Object.keys(users).sort((a, b) => a.localeCompare(b));

  if (names.length === 0) {
    list.appendChild(el("div", { class: "empty-note", style: "padding:8px 4px", text: "No saved profiles yet." }));
  }

  names.forEach((name, i) => {
    const isCurrent = name === ctx.state.currentUser;
    const row = el("div", { style: "display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07)" });
    row.appendChild(avatarDot(name, i, 38, users));
    const info = el("div", { style: "flex:1;min-width:0" });
    info.appendChild(el("div", { style: "font:600 14.5px Figtree,sans-serif;color:#f6f1e4", text: name }));
    info.appendChild(el("div", { style: "font:11.5px Figtree,sans-serif;color:rgba(246,241,228,.45);margin-top:2px", text: isCurrent ? "Current profile" : "Tap to delete" }));
    row.appendChild(info);
    if (!isCurrent) {
      const delBtn = el("button", { class: "icon-btn", style: "background:rgba(192,69,62,.18);color:#e0837c", text: "🗑" });
      delBtn.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: `Delete ${name}?`,
          message: `This removes ${name}'s profile everywhere it's shared. This can't be undone.`,
          confirmLabel: "Delete",
        });
        if (!ok) return;
        delete ctx.state.store.users[name];
        ctx.persist();
        if (ctx.api.configured()) ctx.api.deleteUser(name).catch(() => {});
        rerender();
      });
      row.appendChild(delBtn);
    }
    list.appendChild(row);
  });

  root.appendChild(el("div", { style: "flex:1" }));
}
