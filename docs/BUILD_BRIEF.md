# Build brief — Matched (agent-facing)

You are building the first working version of **Matched**, a mahjong-solitaire PWA for
2–8 players. This is a sibling product to two existing apps by the same owner:
`C:\Users\jhenn\App - Across` (crosswords) and `C:\Users\jhenn\boys-pushup-bonanza`
(fitness game). **Reuse their infrastructure patterns exactly** — same stack, same
conventions, same file shapes — just new domain logic (mahjong instead of crosswords).

Read `docs/Matched_Build_Spec_v1.0.md` in this repo first — it is the full product spec
(screens, copy, colors, mechanics, progression). Read `docs/design-reference.html` for
exact pixel-level styling of every screen (colors, radii, gaps, font sizes) — it's the
raw design canvas source (has `x-dc`/`sc-for`/`sc-if` templating junk in it; ignore that
templating syntax, read it for the CSS values, structure, and copy). Do NOT copy
`ios-frame.jsx` or `support.js` patterns — those are the design tool's own preview
harness, not app code.

## Decisions already made (do not re-ask)

- Full backend now: a Cloudflare Worker + D1 + Durable Object, same shape as Across's
  `worker/index.js` (WebSocket real-time room state + D1 as durable snapshot store).
- This folder (`C:\Users\jhenn\Matched`) is the repo root. Already `git init`'d.
- The board (design option `1f`) must be a **real working game engine**, not a mockup:
  real free-tile detection, solvable board generation by reverse construction, real
  match/select/deselect logic, hint/shuffle/undo, tray with permanent per-player tint,
  simulated opponents that clear tiles on their own, toasts, and reactions.

## Stack to mirror (no build step, vanilla ESM)

- `package.json`: `"type": "module"`, same script names as Across (`serve`, `test`,
  `bundle-worker`, `validate-worker`, `icons`). Use `node --test tests/*.test.mjs` (or
  `.test.js`) for tests — extract pure logic (board generation, free-tile detection,
  scoring, tier math) into testable modules, same as Boys Bonanza's `modes/` pattern.
- `index.html` + `app.js` (orchestration only — screens/game logic live in modules, per
  Boys Bonanza's `AGENTS.md` convention: "Keep app.js as orchestration, not a feature
  warehouse"), `style.css`.
- `screens/` directory: one module per screen (home, play-catalog, room-setup, ranking,
  profile, board, race-board, results, invite, daily). Each screen module renders into a
  root container and wires its own events — same shape as Boys Bonanza's `screens/*.js`.
- `mahjong.js` (or `game/` dir): the board engine — layout definitions, free-tile
  detection, solvable-board generator (reverse construction), match validation, hint
  logic. Pure functions, unit-testable, no DOM.
- `sync.js` / `storage.js` / `api.js`: client networking + local persistence, same
  division of responsibility as Boys Bonanza (`api.js` = REST calls to the Worker,
  `storage.js` = localStorage cache/offline queue, `sync.js` = reconciliation).
- `config.js`: `window.WORKER_URL` + `window.APP_KEY`, same pattern as Across's
  `config.js` (plain script, not a module, assigns onto `window`).
- `sw.js`: app-shell precache service worker, same shape as Across/Boys Bonanza's
  (`CACHE_NAME` with a version suffix, `SHELL_FILES` array, install/activate/fetch
  handlers, network-first for the Worker API, cache-first for the shell). On-demand
  `import()` for anything not needed at startup (per-mode/screen chunks) is preferred
  over dumping everything into the precache list.
- `manifest.json`: name "Matched", short_name "Matched", description "Mahjong
  solitaire for two to eight.", `background_color`/`theme_color` `#0f2a20`
  (matches the felt-dark screen background), icons array pointing at `icons/`.
- `icons/`: generate a full PWA/iOS icon set (192, 512, 1024, maskable 192/512, apple
  touch icon) from the App Icon spec (felt-green rounded square, one bone tile with
  red 中, gold circular ✓ badge bottom-right — exact gradients are in the build spec's
  "App Icon" section and in `design-reference.html` option `1b`). Render it with `sharp`
  (add as a devDependency, same as Boys Bonanza already uses) from an SVG you write,
  via a `scripts/generate-icons.cjs` script with an `npm run icons` entry — don't hand-
  roll a PNG encoder.
- `worker/index.js`: Cloudflare Worker. Mirror Across's `worker/index.js` shape and
  comment-header style (a REST surface documented at the top, `APP_KEY`/
  `ALLOWED_ORIGIN` secrets, a `DB` D1 binding, and a Durable Object binding — call it
  `ROOM` with class `RoomDO`). Endpoints needed: register-user, create-room,
  join-room, list-rooms (open + mine), delete-room, `GET /data` (or per-scope reads),
  a WebSocket upgrade route `/room/:id/connect` routed to the DO, and a
  `complete-room`/snapshot-commit REST fallback. The DO holds live board state
  (tile positions, claimed/cleared pairs + claimant, per-player pair counts, streaks,
  reactions) and pushes diffs to connected sockets, snapshotting to D1 periodically
  and on every clear.
- `migrations/0001_initial.sql`: D1 schema. Tables at minimum: `users` (name, color
  hue, created_at, settings_json), `rooms` (id, title, mode [shared/race/solo], layout
  id, tile_count, visibility, created_by, created_at, state, payload_json snapshot,
  updated_at), `room_players` (room_id, user_name, pairs_cleared, joined_at), and a
  `daily_boards` table (date, layout id/seed) if time allows — otherwise stub it and
  leave a comment. Use the same `CHECK (json_valid(...))` pattern Across uses for JSON
  columns.
- Do **not** attempt to actually deploy the Worker or touch any Cloudflare account —
  there's no `wrangler`/API token available in this environment (matches the sibling
  repos' "Worker redeploys are manual, paste into Cloudflare dashboard Quick Edit"
  note). Just get the Worker code, migration, and a `scripts/deploy-worker.cjs`
  (can be a thin stub referencing the pattern in Across's script) into a deployable
  state, and say clearly in your final summary what manual step the user still owes
  (create the D1 database, paste-deploy the Worker, bind `DB`/`ROOM`, set secrets).
- `AGENTS.md` / `CLAUDE.md` at the repo root: copy the working-conventions style from
  the sibling repos verbatim where it still applies (minimize dialogue, bump
  `sw.js` CACHE_NAME on every shipped change, root scripts are ESM, `.cjs` for the
  older CommonJS scripts, ask clarifying questions one-by-one for major work, verify
  design implementation element-by-element against `docs/design-reference.html`), plus
  a short line pointing at `docs/Matched_Build_Spec_v1.0.md` as the source of truth.

## Game engine specifics (from the spec)

- Tile geometry: 40×52pt face, 40pt column step, 40pt row step, 5pt up-left offset per
  layer (layers stack up-and-left, matching classic mahjong solitaire "turtle" style).
- A tile is **free** iff no tile sits directly above it (any layer above, same
  row/col footprint) AND it is not blocked on both its left and right at its own layer.
- Board generation: reverse construction — start from an empty board, repeatedly pick
  a currently-free position pair and place a matching tile pair there, so the fill
  order gives at least one guaranteed solve order. Support tile counts 36/52/72
  (difficulty presets) plus a placeholder for a 144-tile "turtle" (tablet layout, can be
  unreachable/unused on phone widths for now).
- Tile set: standard mahjong suits — characters/craks (一–九萬), dots, bamboo, winds
  (東南西北), dragons (中發白). Flowers/seasons are out of scope for matching (spec
  marks them as empty `ART SLOT` placeholders) — skip them in the generator for now.
- Assists: hint (find any currently-valid free matching pair, highlight both), shuffle
  (re-randomize remaining tile faces onto the same open positions, keeping solvability),
  undo (revert the last clear), auto-flag no-moves-remaining. Track assist usage per
  player per room — leaderboard credit is reduced when it was used (simple flag/counter
  is enough for v1, exact weighting can be a TODO).
- Simulated opponents (for solo/local preview only, not real multiplayer): idle until
  the human's first match, then occasionally clear a valid free pair on a timer, so a
  shared-board room never looks frozen in a demo/offline context.

## Visual + copy fidelity

Match colors, gradients, radii, type choices, and copy verbatim from
`docs/Matched_Build_Spec_v1.0.md` and `docs/design-reference.html` per screen. Google
Fonts: Instrument Serif (wordmark/titles), Figtree (UI), Noto Serif SC (tile glyphs) —
load the same way Across does (see its `index.html` `<link>` tags). Sentence case
everywhere. Per the sibling repos' convention: verify each screen against the reference
element-by-element once built, don't just eyeball it from memory.

## Definition of done for this pass

1. `npm run serve` boots a local static server and every screen in the bottom-nav is
   reachable and visually matches the reference (colors/spacing/copy), including the
   swipeable Home hero, layout catalog, room setup, ranking, profile, live board (real
   gameplay), race board, results, invite/join, and daily puzzle.
2. The shared board is genuinely playable end to end against simulated opponents:
   tap two free matching tiles, they clear to the tray tinted in your color, hint/
   shuffle/undo work, the board is always solvable.
3. `node --test` passes for the extracted game-engine/scoring/tier modules.
4. Worker + D1 migration + Durable Object code exists and is internally consistent
   with the client's `api.js`/`sync.js`, but is not deployed — summarize the manual
   Cloudflare steps still owed.
5. PWA installs cleanly (manifest + icons + service worker), matching the sibling
   apps' `sw.js` shape.
6. Commit the work locally with git (no remote push).
