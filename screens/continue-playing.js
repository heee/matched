// Expanded list of every unfinished room the current player has joined.

import { el } from "./shared-ui.js";
import { continuePlayingRooms } from "../game/room-lists.js?v=6";
import { continueRow } from "./home.js?v=62";

export function renderContinuePlaying(root, ctx) {
  const rooms = continuePlayingRooms(
    Object.values(ctx.state.store.rooms || {}),
    ctx.state.currentUser,
  );

  const header = el("div", { class: "screen-header", style: "padding-top:6px" });
  header.appendChild(el("button", {
    class: "icon-btn",
    text: "‹",
    "aria-label": "Back to home",
    onClick: () => ctx.navigate("home"),
  }));
  header.appendChild(el("div", { class: "title-serif", style: "font-size:26px;flex:1", text: "Continue playing" }));
  root.appendChild(header);

  const list = el("div", { class: "row-list", style: "padding-top:8px" });
  if (rooms.length === 0) {
    list.appendChild(el("div", {
      class: "empty-note",
      style: "padding:0 4px",
      text: "Your unfinished rooms will show up here.",
    }));
  }
  rooms.forEach((room) => list.appendChild(continueRow(ctx, room)));
  root.appendChild(list);
  root.appendChild(el("div", { style: "flex:1" }));
}
