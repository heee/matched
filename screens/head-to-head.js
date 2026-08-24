import { el, avatarDot } from "./shared-ui.js";
import { headToHeadStats } from "../game/head-to-head.js";

const PERIODS = ["Today", "Week", "Month", "All time"];

export function renderHeadToHead(root, ctx, params = {}) {
  const opponent = params.user;
  if (!opponent || opponent === ctx.state.currentUser || !ctx.state.store.users?.[opponent]) {
    ctx.navigate("ranking");
    return;
  }

  let period = params.period && PERIODS.includes(params.period) ? params.period : "Week";
  let periodOpen = false;
  const currentUser = ctx.state.currentUser;

  const header = el("div", { style: "padding:6px 16px 14px;display:flex;align-items:center;gap:10px" });
  header.appendChild(el("button", { class: "icon-btn", style: "width:38px;height:38px", text: "‹", "aria-label": "Back to Ranking", onClick: () => ctx.navigate("ranking") }));
  header.appendChild(el("div", { class: "title-serif", style: "flex:1;font-size:27px", text: "Head to head" }));
  const periodDropdown = el("div", { style: "position:relative" });
  header.appendChild(periodDropdown);
  root.appendChild(header);

  const content = el("div", { style: "padding:0 16px 22px;display:flex;flex-direction:column;gap:12px" });
  root.appendChild(content);

  function renderPeriodDropdown() {
    periodDropdown.innerHTML = "";
    const trigger = el("button", { style: "display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);font:600 12.5px Figtree,sans-serif;color:#f6f1e4;cursor:pointer" });
    trigger.appendChild(el("span", { text: period }));
    trigger.appendChild(el("span", { style: `font-size:10px;color:rgba(246,241,228,.5);display:inline-block;transform:rotate(${periodOpen ? 180 : 0}deg)`, text: "▾" }));
    trigger.addEventListener("click", (event) => { event.stopPropagation(); periodOpen = !periodOpen; renderPeriodDropdown(); });
    periodDropdown.appendChild(trigger);
    if (!periodOpen) return;
    const menu = el("div", { style: "position:absolute;top:calc(100% + 6px);right:0;min-width:132px;padding:6px;border-radius:12px;background:#183226;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 24px rgba(0,0,0,.4);z-index:40;display:flex;flex-direction:column;gap:2px" });
    PERIODS.forEach((value) => {
      const active = value === period;
      const item = el("button", { style: `text-align:left;padding:8px 10px;border-radius:8px;border:none;cursor:pointer;background:${active ? "rgba(217,164,65,.18)" : "none"};color:${active ? "#e8c887" : "#f6f1e4"};font:${active ? 700 : 600} 13px Figtree,sans-serif`, text: value });
      item.addEventListener("click", (event) => { event.stopPropagation(); period = value; periodOpen = false; renderPeriodDropdown(); renderContent(); });
      menu.appendChild(item);
    });
    periodDropdown.appendChild(menu);
  }

  function renderContent() {
    content.innerHTML = "";
    const stats = headToHeadStats(ctx.state.store.rooms || {}, currentUser, opponent, period);
    const [me, them] = stats.players;

    const people = el("div", { style: "display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:18px;border-radius:18px;background:linear-gradient(150deg,rgba(217,164,65,.16),rgba(255,255,255,.05));border:1px solid rgba(217,164,65,.28)" });
    const person = (name, seat, label) => {
      const node = el("div", { style: "display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0" });
      node.appendChild(avatarDot(name, seat, 52, ctx.state.store.users));
      node.appendChild(el("div", { style: "font:700 14px Figtree,sans-serif;color:#f6f1e4;max-width:100%;overflow:hidden;text-overflow:ellipsis", text: label }));
      return node;
    };
    people.appendChild(person(currentUser, 0, "You"));
    people.appendChild(el("div", { class: "title-serif", style: "font-size:22px;color:rgba(246,241,228,.45)", text: "vs" }));
    people.appendChild(person(opponent, 1, opponent));
    content.appendChild(people);

    const record = el("div", { style: "padding:14px 15px;border-radius:15px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.08);text-align:center" });
    record.appendChild(el("div", { style: "font:700 10.5px Figtree,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(246,241,228,.45)", text: "Boards played together" }));
    record.appendChild(el("div", { style: "font:700 22px Figtree,sans-serif;color:#f6f1e4;margin-top:7px", text: String(stats.together.boards) }));
    const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
    record.appendChild(el("div", { style: "font:12px Figtree,sans-serif;color:rgba(246,241,228,.62);margin-top:3px", text: `${countLabel(stats.together.currentWins, "win")} · ${countLabel(stats.together.opponentWins, "loss", "losses")} · ${countLabel(stats.together.ties, "tie")}` }));
    content.appendChild(record);

    const metricCard = el("div", { style: "padding:4px 14px;border-radius:17px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)" });
    const metrics = [
      ["Boards completed", me.boards, them.boards, ""],
      ["Pairs matched", me.pairs, them.pairs, ""],
      ["Average board share", me.share, them.share, "%"],
      ["Best streak", me.bestStreak, them.bestStreak, ""],
    ];
    metrics.forEach(([label, myValue, theirValue, suffix], index) => {
      const row = el("div", { style: `padding:13px 0;${index ? "border-top:1px solid rgba(255,255,255,.07)" : ""}` });
      const values = el("div", { style: "display:grid;grid-template-columns:62px 1fr 62px;align-items:center;gap:10px" });
      values.appendChild(el("div", { style: "font:700 15px Figtree,sans-serif;color:#e8c887", text: `${myValue}${suffix}` }));
      values.appendChild(el("div", { style: "font:600 12px Figtree,sans-serif;color:rgba(246,241,228,.65);text-align:center", text: label }));
      values.appendChild(el("div", { style: "font:700 15px Figtree,sans-serif;color:#5fbf9b;text-align:right", text: `${theirValue}${suffix}` }));
      row.appendChild(values);
      const total = Number(myValue) + Number(theirValue);
      const myPct = total ? Math.round((Number(myValue) / total) * 100) : 50;
      row.appendChild(el("div", { style: "height:5px;border-radius:3px;overflow:hidden;background:#5fbf9b;margin-top:8px", html: `<div style="height:100%;width:${myPct}%;background:#d9a441"></div>` }));
      metricCard.appendChild(row);
    });
    content.appendChild(metricCard);
  }

  const closeDropdown = () => { if (periodOpen) { periodOpen = false; renderPeriodDropdown(); } };
  document.addEventListener("click", closeDropdown);
  window.__matchedCleanup = () => document.removeEventListener("click", closeDropdown);
  renderPeriodDropdown();
  renderContent();
  root.appendChild(el("div", { style: "flex:1" }));
}
