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
