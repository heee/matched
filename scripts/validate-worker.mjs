// Sanity-checks worker/index.js without deploying anything: valid JS syntax
// (via dynamic import, which also catches top-level reference errors in
// anything evaluated at module-load time), and that the expected exports
// exist. Mirrors the intent of Across's validate-worker.mjs.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

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
const requiredExports = ["loadData", "registerUser", "upsertRoom", "getRoom", "joinRoom", "deleteRoom", "buildRoom", "validateCreateRoom", "generateBoard", "getOrCreateDaily"];
const missing = requiredExports.filter((name) => typeof mod[name] !== "function");
if (missing.length) {
  console.error(`worker/index.js is missing expected exports: ${missing.join(", ")}`);
  process.exit(1);
}

// Smoke-test board generation for every curated layout so a syntax-valid
// but logically broken generator still fails this check before deploy.
for (const layoutId of ["two-bridges", "dragons-nest", "eight-winds", "garden-gate", "nine-gates", "long-table"]) {
  const tiles = mod.generateBoard(layoutId, 12345);
  if (!Array.isArray(tiles) || tiles.length === 0 || tiles.length % 2 !== 0) {
    console.error(`generateBoard(${layoutId}) returned an invalid board`);
    process.exit(1);
  }
}

console.log("worker/index.js looks valid: exports present, board generation works for every layout.");
