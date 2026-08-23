// Matched — first-run player picker. Same shape as Across/Boys Pushup
// Bonanza's name entry: pick a known profile card or add a new player;
// only shown when no local user is saved yet.

import { el, initialFor } from "./shared-ui.js";
import { isActualPlayerName } from "../game/identity.js";

export function renderNameEntry(root, ctx) {
  root.classList.add("bg-felt");
  const wrap = el("div", { class: "name-entry" });

  wrap.appendChild(el("img", {
    class: "matching-tiles-mark",
    src: "./icons/matched-tiles.png",
    alt: "Two matching mahjong tiles",
    width: "88",
    height: "56",
  }));

  wrap.appendChild(el("div", { class: "wordmark", text: "Matched" }));
  wrap.appendChild(el("div", { class: "title-serif", style: "font-size:22px;margin-top:2px", text: "Who's playing?" }));
  wrap.appendChild(el("div", { style: "font:13.5px Figtree,sans-serif;color:rgba(246,241,228,.6);margin:-4px 0 4px", text: "Pick your name, or add someone new" }));

  const grid = el("div", { class: "profile-picker-grid" });
  wrap.appendChild(grid);

  const form = el("form", { class: "new-player-form", style: "display:none" });
  const input = el("input", { type: "text", maxlength: "40", placeholder: "Your name", autocomplete: "off" });
  const submit = el("button", { class: "btn btn-primary btn-lg", type: "submit", style: "width:100%", text: "Let's go" });
  form.appendChild(input);
  form.appendChild(submit);
  wrap.appendChild(form);

  const users = ctx.state.store.users || {};
  const recentName = ctx.state.currentUser;
  const entries = Object.entries(users).sort(([a], [b]) => (a === recentName ? -1 : b === recentName ? 1 : a.localeCompare(b)));
  if (entries.length === 1) grid.classList.add("single-user");

  function choose(name) {
    if (!name) return;
    form.style.display = "none";
    ctx.selectUser(name);
  }

  for (const [name, user] of entries) {
    const card = el("div", { class: "profile-card" });
    card.appendChild(el("div", { class: "profile-card-avatar", style: `background:oklch(58% .1 ${user.hue ?? 0})`, text: initialFor(name) }));
    card.appendChild(el("div", { class: "profile-card-name", text: name }));
    card.addEventListener("click", () => choose(name));
    grid.appendChild(card);
  }

  const newCard = el("div", { class: "profile-card new-player" });
  newCard.appendChild(el("div", { class: "profile-card-avatar", text: "+" }));
  newCard.appendChild(el("div", { class: "profile-card-name", text: "New player" }));
  newCard.addEventListener("click", () => {
    form.style.display = "flex";
    input.focus();
  });
  grid.appendChild(newCard);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim().slice(0, 40);
    if (!name) return;
    if (!isActualPlayerName(name)) { ctx.toast("Choose your actual name — ‘You’ is only used as a label."); return; }
    if (users[name]) { ctx.toast(`"${name}" is already taken — pick that card instead, or use a different name`); return; }
    choose(name);
  });

  root.appendChild(wrap);
}
