import test from "node:test";
import assert from "node:assert/strict";
import {
  inviteNoticeMessage,
  liveBoardShareMessage,
  newBoardShareMessage,
  resultShareMessage,
} from "../game/share-messages.js";

test("new-board shares name the challenger and board", () => {
  const message = newBoardShareMessage({ inviter: "Henning", title: "Dragon's Nest" }, () => 0);
  assert.match(message, /Henning/);
  assert.match(message, /Dragon's Nest/);
  assert.match(message, /pairs|tiles|move|competition|challenge|seat/i);
});

test("live shares use current board state and vary", () => {
  const messages = [0, 0.17, 0.34, 0.5, 0.67, 0.84].map((random) => liveBoardShareMessage({
    title: "Dragon's Nest", cleared: 32, total: 52, left: 20, pct: 62,
  }, () => random));
  assert.ok(messages.every((message) => message.includes("Dragon's Nest")));
  assert.ok(messages.some((message) => /20|32|52|62/.test(message)));
  assert.ok(new Set(messages).size > 4);
});

test("result shares include the performance being challenged and vary", () => {
  const messages = [0, 0.2, 0.4, 0.6, 0.8, 0.99].map((random) => resultShareMessage({
    title: "Dragon's Nest", elapsed: "4:12", pairs: 14, rank: 1, playerCount: 4,
  }, () => random));
  assert.ok(messages.every((message) => message.includes("Dragon's Nest")));
  assert.ok(messages.every((message) => /4:12|14|#1/.test(message)));
  assert.ok(new Set(messages).size > 4);
});

test("received invitation notices keep the playful competitive voice", () => {
  const message = inviteNoticeMessage({ fromUser: "Henning", roomTitle: "Dragon's Nest" }, () => 0.5);
  assert.match(message, /Henning/);
  assert.match(message, /Dragon's Nest/);
  assert.match(message, /seat|pairs|competition|confident/i);
});
