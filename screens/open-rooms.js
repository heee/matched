// Expanded list of every room currently open for the current player to join.

import { el } from "./shared-ui.js";
import { openRoomsForUser } from "../game/room-lists.js?v=6";
import { openRow } from "./home.js?v=62";

export function renderOpenRooms(root, ctx) {
  const rooms = openRoomsForUser(
    Object.values(ctx.state.store.rooms || {}),
    ctx.state.store.users,
    ctx.state.currentUser,
  );

  const header = el("div", { class: "screen-header", style: "padding-top:6px" });
  header.appendChild(el("button", {
    class: "icon-btn",
    text: "‹",
    "aria-label": "Back to home",
    onClick: () => ctx.navigate("home"),
  }));
  header.appendChild(el("div", { class: "title-serif", style: "font-size:26px;flex:1", text: "Open rooms" }));
  root.appendChild(header);

  root.appendChild(el("div", {
    class: "section-helper",
    style: "padding-top:4px",
    text: "Started by other players and open for you to join.",
  }));

  const list = el("div", { class: "row-list", style: "padding-top:8px" });
  if (rooms.length === 0) {
    list.appendChild(el("div", {
      class: "empty-note",
      style: "padding:0 4px",
      text: "No open rooms yet — create one from the + tab.",
    }));
  }
  rooms.forEach((room) => list.appendChild(openRow(ctx, room)));
  root.appendChild(list);
  root.appendChild(el("div", { style: "flex:1" }));
}
