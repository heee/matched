import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../style.css", import.meta.url), "utf8"),
]);

test("fixed tab bar stays outside the scrolling app shell", () => {
  const appClose = html.indexOf("</div>", html.indexOf('<div id="app">'));
  const tabBar = html.indexOf('id="tab-bar"');

  assert.ok(tabBar > appClose, "tab bar must not be nested inside #app");
  assert.match(css, /#app\s*\{[\s\S]*?overflow-x:\s*clip;/);
  assert.match(css, /\.tab-bar\s*\{[\s\S]*?position:\s*fixed;/);
});

test("iPad mini tablet shell fills the viewport without side gutters", () => {
  const tabletRules = css.slice(css.indexOf("@media (min-width: 744px)"));

  assert.match(tabletRules, /#app\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*960px;/);
  assert.match(tabletRules, /\.tab-bar\s*\{[^}]*max-width:\s*960px;/);
  assert.doesNotMatch(tabletRules, /94vw/);
});

test("player picker centers equal-width cards in two-column rows", () => {
  assert.match(css, /\.profile-picker-grid\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*center;/);
  assert.match(css, /\.profile-card\s*\{[^}]*width:\s*calc\(50% - 5px\);/);
  assert.doesNotMatch(css, /\.profile-card\.new-player\s*\{[^}]*width:/);
});
