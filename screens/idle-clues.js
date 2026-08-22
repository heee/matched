// Per-screen idle timer for passive board clues. This is deliberately a
// visual-only aid: unlike the explicit Hint button, it does not mutate room
// state or reduce leaderboard credit.

import { findRandomHintPair } from "../game/mahjong.js";

export const CLUE_IDLE_MS = 20_000;
const CLUE_VISIBLE_MS = 1_900;

export function createIdleClueController({ enabled, getTiles, getTileElement }) {
  let idleTimer = null;
  let fadeTimer = null;
  let clueNodes = [];
  let stopped = false;

  function clearClue() {
    clearTimeout(fadeTimer);
    fadeTimer = null;
    clueNodes.forEach((node) => node?.classList.remove("idle-clue"));
    clueNodes = [];
  }

  function schedule() {
    clearTimeout(idleTimer);
    idleTimer = null;
    if (stopped || !enabled || document.hidden) return;
    idleTimer = setTimeout(() => {
      idleTimer = null;
      const pair = findRandomHintPair(getTiles());
      clearClue();
      if (pair) {
        clueNodes = pair.map(getTileElement).filter(Boolean);
        clueNodes.forEach((node) => {
          node.classList.remove("idle-clue");
          void node.offsetWidth;
          node.classList.add("idle-clue");
        });
        fadeTimer = setTimeout(clearClue, CLUE_VISIBLE_MS);
      }
      schedule();
    }, CLUE_IDLE_MS);
  }

  function reset() {
    clearClue();
    schedule();
  }

  function onVisibilityChange() {
    reset();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  schedule();

  return {
    reset,
    stop() {
      stopped = true;
      clearTimeout(idleTimer);
      idleTimer = null;
      clearClue();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
