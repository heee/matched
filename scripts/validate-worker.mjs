// Sanity-checks worker/index.js without deploying anything: valid JS syntax
// (via dynamic import, which also catches top-level reference errors in
// anything evaluated at module-load time), and that the expected exports
// exist. Mirrors the intent of Across's validate-worker.mjs.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { LAYOUTS } from "../game/layouts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.join(__dirname, "..", "worker", "index.js");

const source = readFileSync(workerPath, "utf8");
if (!source.includes("export default")) {
  console.error("worker/index.js has no default export (the fetch handler).");
  process.exit(1);
}
if (!source.includes("export class RoomDO")) {
  console.error("worker/index.js has no exported RoomDO Durable Object class.");
  process.exit(1);
}

const mod = await import(pathToFileURL(workerPath));
const requiredExports = ["loadData", "registerUser", "upsertRoom", "getRoom", "joinRoom", "deleteRoom", "deleteUser", "buildRoom", "validateCreateRoom", "generateBoard", "getOrCreateDaily"];
const missing = requiredExports.filter((name) => typeof mod[name] !== "function");
if (missing.length) {
  console.error(`worker/index.js is missing expected exports: ${missing.join(", ")}`);
  process.exit(1);
}

// Smoke-test board generation for every curated layout so a syntax-valid
// but logically broken generator still fails this check before deploy.
// Pulled from LAYOUT_POSITIONS' own keys (via the source text — it isn't
// exported) rather than a hardcoded list, so a newly added layout is
// covered automatically instead of silently skipped like the last batch
// was until this was fixed.
const layoutIdMatches = [...source.matchAll(/^\s*"([a-z0-9-]+)":\s*\(\)\s*=>/gm)].map((m) => m[1]);
if (layoutIdMatches.length === 0) {
  console.error("Could not find any LAYOUT_POSITIONS entries to test — regex may be stale.");
  process.exit(1);
}
const clientLayoutIds = Object.keys(LAYOUTS);
if (layoutIdMatches.slice().sort().join("\n") !== clientLayoutIds.slice().sort().join("\n")) {
  console.error("Worker layout IDs do not match game/layouts.js");
  process.exit(1);
}
for (const layoutId of layoutIdMatches) {
  const tiles = mod.generateBoard(layoutId, 12345);
  if (!Array.isArray(tiles) || tiles.length === 0 || tiles.length % 2 !== 0) {
    console.error(`generateBoard(${layoutId}) returned an invalid board`);
    process.exit(1);
  }
}
console.log(`Checked ${layoutIdMatches.length} layouts: ${layoutIdMatches.join(", ")}`);

console.log("worker/index.js looks valid: exports present, board generation works for every layout.");
