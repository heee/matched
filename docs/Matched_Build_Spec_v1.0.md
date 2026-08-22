# Matched

## Product Vision & Build Specification (v1.0)

### Tagline

**Mahjong solitaire for two to eight.**

## Vision

Matched is a mobile-first Progressive Web App that lets a small group of friends and family (2–8 people) clear a mahjong solitaire board together — live on a single shared board, side by side in a race, or alone. It is a sibling product to Across (collaborative crosswords): the same infrastructure, room model, and social scaffolding, with a new tile-first visual identity.

The board is the product. Everything else is a frame around it.

## Product Principles

1. The board is the interface.
2. Collaboration is the default; solo is a first-class fallback, not a lesser mode.
3. Creating a room takes under one minute.
4. The whole board always fits the screen. It never pans or zooms.
5. Progression is earned and cosmetic — it changes how the table looks, never how it plays.
6. Tile-first visual language: felt table, warm wood, physical bone tiles with a real edge.

## Target Audience

Small friend and family groups, mixed adult and child. Not a broad public social product. Copy tone is playful and competitive.

---

## Navigation

Bottom navigation, exactly 5 items: **Home · Play · + · Ranking · You**

- Home — active rooms, today's board, open rooms
- Play — layout catalog
- **+** — create room (room setup)
- Ranking — leaderboards (icon is three stroke-only ascending bars)
- You — profile, tiers, settings

Sentence case for all headers and labels ("Continue playing", not "Continue Playing").

---

## Screens

### Home

- **Swipeable hero card.** Three states, swiped horizontally with chevron controls outside both edges of the card, dot indicators below, and pointer/touch drag:
  1. **Live now** — the room you are currently in. Elapsed clock, mini board silhouette, title, "Shared board · 72 tiles · 61% cleared", a split progress bar breaking that 61% into each player's share colored by player identity, primary action "Jump back in", plus a chat shortcut.
  2. **Today's board** — the daily puzzle. Countdown to reset, title, "3 of 5 in your group have finished. Best time 4:12", actions "Play daily" and "Results".
  3. **Your day** — the active player's local-calendar-day overview, counting completed boards only: boards, pairs matched, average completion time, and best streak.
- **Continue playing** — vertical list (never a horizontal carousel) of rooms you have joined but are not currently in. Each row: mini board thumbnail (the layout's real tile silhouette, not a generic icon), title, status line, thin completion bar, one avatar.
- **Open rooms** — vertical list of joinable rooms. Row: tile-count chip, title, "Shared · 60 tiles · 1 joined", "Join".

### Play — Layout catalog

- Layouts are **curated, not generated**. Mahjong geometry does not benefit from generation the way crossword fill does.
- Two-column grid of cards. Thumbnail draws the actual tile silhouette of the layout.
- Filter chips: All · Easy · Classic · Locked.
- Locked layouts stay visible with a lock badge and the tier that unlocks them, so progression always has a named target.

### + — Room setup

One scrollable screen, never a wizard. Target: under a minute from tap to invite.

1. **Mode** — three cards, the first decision because it changes the board, the scoring, and the presence model:
   - **Shared** — one board, everyone tapping, first to a pair takes it.
   - **Race** — same layout, own board, live progress bars.
   - **Solo** — just you; times still count toward Ranking and the daily streak.
2. **Layout** — row showing the current pick with a silhouette thumbnail; opens the catalog.
3. **Difficulty** — Easy / Medium / Hard preset toggle, which sets tile count (36 / 52 / 72). Easy doubles as the mixed adult-and-child mode.
4. **Toggles** — Free tiles glow · Hints allowed · Open to anyone with the link.
5. Single primary action: **Create & invite**, which creates the room and opens the invite sheet immediately.

### Ranking

- Time filters: Today · Week · Month · All time.
- **One metric at a time**, behind a "Change" control. Never a dense table. Metrics: Pairs cleared (default) · Speed to clear · Board completion share.
- Rows: rank numeral (gold for 1st, no medals or podium), avatar, name, sub-line ("9 boards · 4:38 avg"), metric value.
- The current user's row is highlighted in gold wherever it falls.

### You — Profile

- Avatar, display name, tier line ("Jade tier · 9,140 points").
- **Tier bar sits above stats** — progression is the reason to come back. Shows current tier, points to the next tier, and the two next unlocks by name.
- **This month** — 2×2 stat grid using the same metrics Ranking sorts by, so the two screens never disagree.
- **Your table** — the currently applied tile material and felt; this is where a new unlock gets equipped.
- Settings flattened onto this screen: direct toggle rows only. No sub-pages, no email field, no sign-out row.

### Board (the game)

**Constraint that drives everything:** the whole board always fits the screen. No pan, no zoom, no magnifier. On a 402pt-wide iPhone this caps a layer at roughly 8 columns × 5 rows, so the catalog tops out near 72 tiles. The classic 144-tile turtle is a tablet layout.

Tile geometry: 40 × 52pt face, 40pt column step, 40pt row step, 5pt up-left offset per layer.

**Shared board (primary mode)**

- Header: home button, room title, "N of 52 cleared · MM:SS", and the **✦ Assist** button (amber tinted).
- **Player score cards** across the top, one per player: identity-colored initial dot, pairs taken, and a sub-label that shows the player's name normally and switches to "N streak" at two or more consecutive matches.
- **Board** centered in the remaining space.
- **Tray** along the bottom: cleared pairs fly here and stay ringed in the taker's identity color. This is permanent attribution — the mahjong equivalent of Across's per-letter coloring. Summary line reads "You 3 pairs · board 42%".
- **Controls row**: Shuffle · Undo, then reaction buttons (🔥 😮) on the right.
- **Presence**: a toast announces another player's match, outlined in their color; reactions float up over the felt; streaks surface as ambient lines ("Dana is on a 4 streak"), never blocking.

**Tile interaction**

- A tile is **free** when no tile sits directly above it and it is not blocked on both left and right at its own layer.
- Tap a free tile to select (lifts 3px, gold ring). Tap its match to clear both. Tap a different free tile to move the selection.
- Blocked tiles are dimmed and desaturated and reject the tap.
- Boards are generated by reverse construction — pairs are placed onto positions that are free in the remaining set — so every board is solvable in at least one order.

**Race mode**

- Same layout, separate boards. Nobody can take a tile out from under you.
- **Night-slate felt** instead of green so the mode is obvious at a glance.
- Live progress bars, one per player, ordered by position rather than seat.
- Standing changes surface in a bottom strip instead of a toast — there is no shared board to interrupt.
- No tray; your cleared pairs are implied by your own bar.

**Assists (behind ✦)**

Hint (highlights one valid pair) · Shuffle when stuck · Undo last match · Auto-flag when no moves remain · Free-tile glow toggle. Usage is tracked and reduces leaderboard credit.

### Daily puzzle

- One board for everyone, one attempt, resets on a 24h clock.
- The **streak lives here**, not on Home — it is tied to the habit that earns it.
- "Your group today" list: who has finished and their time.
- **Group times stay hidden until you finish**, so nobody plays to a target.
- Finishing feeds the same metrics Ranking sorts by. The daily is not a separate scoreboard.

### Results

- "Board cleared", title, "14:22 · 4 players · 52 tiles".
- **A real 1–4 ranking** by pairs cleared, each row with the player's share as a bar. Not soft MVP callouts.
- **Worth mentioning** — three highlight lines generated from the match log, written competitively rather than congratulatory (e.g. "Dana ran a 7-pair streak in the last minute and took it from you").
- Points earned and distance to the next tier, closing the loop back into progression.
- Three actions in one row: **Share · Rematch · Done**.
- Share hands off to the **OS-native share sheet** with a prefilled message and deep link. No in-app share screen.

### Invite and join by link

- **Invite sheet** (bottom sheet over the board): copyable link (`matched.app/r/<slug>`), recent people as one-tap invite chips, "Share invite" as the primary action.
- **Recipient's first screen**: two tiles as the mark, "Dana invited you to Dragon's Nest", room summary, stacked avatars of who is already playing, primary action **"Take a seat"**, secondary "Just watching for now" (spectator mode — sees the board, cannot take tiles).
- No account and no download wall. **Joining commits at the first cleared pair**, matching the Across rule.

---

## Multiplayer Model

- Shared mode is **free-for-all**: everyone taps the same live board, first to a pair takes it. Tiles are not reserved.
- Single persistent board per room; live synchronization; progress auto-saves after every match.
- Players may leave and resume anytime.
- Join occurs on first cleared pair.
- Presence is communicated by: identity-colored tray entries (permanent), a toast per match, streak lines, and reactions. No live cursor tracking.

## Scoring

Leaderboard inputs: **pairs cleared per player**, **speed / time to clear**, **board completion share**. Assist usage reduces credit. Solo play reports into the same metrics.

## Progression

- Points accumulate across all modes.
- **Four named tiers: Bamboo → Bone → Jade → Dragon.** Each tier unlocks a batch, not a single item.
- Unlocks are cosmetic only: **tile materials** (Bone / Jade / Rosewood / Lacquer), **table felts**, **board layouts**, and tile face styles.
- Equipped items live under "Your table" on the profile.

Reference tier values used in the design: Bone (start), Jade (2,500), Rosewood (8,000), Lacquer / Dragon (20,000).

---

## Visual Design

- **Table**: felt green as the default (`radial-gradient` from `#20694e` through `#134130` to `#0a2a1f`). **Night slate** (`#1d5f6e → #0a232b`) for race mode and as a low-light option. Tier-unlocked felts: deep felt at Jade, a wood-rail table at Rosewood. **Never more than two board colors in play at once** — tiles are the only real source of color.
- **Tiles**: bone face (`linear-gradient(160deg,#f7f2e4,#e9e0cb)`), 6px radius, a hard offset edge (`box-shadow: 3px 4px 0 #b3a582`) plus a soft drop shadow. Upper-layer tiles are slightly brighter. Selection is a 3px gold ring plus a 3px lift.
- **Accent**: gold `#d9a441` for primary actions and the current user.
- **Player identity colors**: `#d9a441` (you), `#5fbf9b`, `#e08a6a`, `#7aa8e0`, then rotate hue in OKLCH at the same chroma and lightness. Do not add colors outside this rotation.
- **Ink colors on tile faces**: `#23201c` ink, `#b5322c` red, `#1f7a4d` green, `#2b5f9e` blue.
- **Typography**: Instrument Serif for the wordmark and screen titles; Figtree for all UI; Noto Serif SC for tile characters.
- **Surfaces on felt**: translucent white glass cards (`rgba(255,255,255,.06–.13)`) with hairline borders, 14–18px radius.
- **Motion**: restrained. Tiles pop in at 250ms; matched pairs fly to the tray; completion is a soft glow with light haptics, never confetti.

## App Icon

Felt-green rounded square (`radial-gradient(120% 120% at 30% 20%, #2a7a5c, #14513c, #0d3a2b)`) with a single upright bone tile bearing the red 中 dragon, and a gold circular ✓ badge overlapping its bottom-right corner. Reads at 60px.

## Tile Art

**Real tile art will be supplied and dropped into slots.** Every tile face is a slot sized 40 × 52 at 1×. In the design file the faces are placeholders built from type and geometry:

- Characters (craks 一–九萬, winds 東南西北, dragons 中 發 白) — set in Noto Serif SC.
- Dots and bamboo — geometric pips and sticks.
- Flowers and seasons — marked explicitly as empty `ART SLOT` placeholders.

Nothing about the layout depends on the placeholder rendering; swapping in real art moves nothing.

## Technology

- Progressive Web App, mobile-first, iPhone optimized (402 × 874pt design target), responsive.
- Real-time synchronization; deep-linkable rooms; push notifications.
- No account required to join by link.

## Brand

Name: **Matched**

The emotional rhythm: Join → Clear together → Celebrate → Share → Play again.

---

## Design File

`Matched - Mobile App.dc.html` — a single canvas holding the app icon, the tile-material tier system, and every screen listed above as an iPhone frame with an annotation panel beside it. The shared board (option 1f) is a working prototype: real free-tile logic, solvable board generation, matching, tray attribution, simulated opponents, hint, shuffle, undo, reactions, and toasts.
