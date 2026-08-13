// Matched — Cloudflare Worker.
//
// D1 is the durable source of truth for users and room snapshots. One
// RoomDO Durable Object per room holds live board state and pushes diffs to
// connected players over WebSockets, snapshotting that state back to D1
// periodically and on every clear.
//
//   GET  /data?scope=open|mine&user=NAME     -> current D1 contents (no auth to read)
//   GET  /daily                              -> today's shared daily board (generated/cached in D1)
//   POST /register-user   { user }                      -> creates the user if new, assigns a stable color hue
//   POST /create-room     { title, mode, layoutId, tileCount, difficulty, visibility, createdBy }
//                                                          -> generates a solvable board server-side and seeds the room's DO
//   POST /join-room       { roomId, user }                -> adds user to the room's player list
//   POST /list-rooms      -> see GET /data?scope=... (kept as GET for simple client caching)
//   POST /delete-room     { roomId }                      -> removes the room from D1, wipes its RoomDO state
//   POST /delete-user     { user }                        -> removes the user from D1 (local-only bots are never
//                                                             registered here, so this only ever affects real profiles)
//   POST /complete-room   { roomId, payload }              -> manual/fallback snapshot commit; the RoomDO normally
//                                                             commits snapshots directly (see commitSnapshot below)
//   GET/Upgrade /room/:id/connect                          -> WebSocket, routed to that room's RoomDO
//
// Required Worker secrets/variables (Settings -> Variables and Secrets):
//   APP_KEY        (secret)  any string; must match APP_KEY in config.js — a casual
//                            deterrent only, not real auth (visible in client source)
//   ALLOWED_ORIGIN (var)     e.g. "https://<you>.github.io"
//
// Required bindings (Settings -> Bindings):
//   DB    -> D1 database containing migrations/0001_initial.sql
//   ROOM  -> class RoomDO (this file)

const PLAYER_HUES = [42, 155, 20, 213, 280, 190, 340, 95];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const roomConnectMatch = url.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)\/connect$/);
    if (roomConnectMatch) {
      const id = env.ROOM.idFromName(roomConnectMatch[1]);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/data" && request.method === "GET") {
      try {
        const scope = url.searchParams.get("scope") || "all";
        const user = url.searchParams.get("user") || "";
        return json(await loadData(env.DB, scope, user), 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/daily" && request.method === "GET") {
      try {
        return json(await getOrCreateDaily(env.DB), 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/register-user" && request.method === "POST") {
      if (!checkAppKey(request, env)) return json({ error: "unauthorized" }, 401, cors);
      const body = await safeJson(request);
      const name = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      if (!name) return json({ error: "invalid user" }, 400, cors);
      try {
        const user = await registerUser(env.DB, name);
        return json({ ok: true, user: { name, ...user } }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/create-room" && request.method === "POST") {
      if (!checkAppKey(request, env)) return json({ error: "unauthorized" }, 401, cors);
      const body = await safeJson(request);
      const validated = validateCreateRoom(body);
      if (!validated) return json({ error: "invalid room payload" }, 400, cors);
      try {
        const room = buildRoom(validated);
        await upsertRoom(env.DB, room);
        const roomId = env.ROOM.idFromName(room.id);
        const stub = env.ROOM.get(roomId);
        await stub.fetch("https://internal/seed", {
          method: "POST",
          body: JSON.stringify(room),
          headers: { "Content-Type": "application/json" },
        });
        return json({ ok: true, room }, 200, cors);
      } catch (e) {
        return json({ error: `creation failed: ${e.message}` }, 422, cors);
      }
    }

    if (url.pathname === "/join-room" && request.method === "POST") {
      if (!checkAppKey(request, env)) return json({ error: "unauthorized" }, 401, cors);
      const body = await safeJson(request);
      const roomId = typeof body?.roomId === "string" ? body.roomId.slice(0, 64) : "";
      const user = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      if (!roomId || !user) return json({ error: "invalid payload" }, 400, cors);
      try {
        await joinRoom(env.DB, roomId, user);
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/delete-room" && request.method === "POST") {
      if (!checkAppKey(request, env)) return json({ error: "unauthorized" }, 401, cors);
      const body = await safeJson(request);
      const roomId = typeof body?.roomId === "string" ? body.roomId.slice(0, 64) : "";
      if (!roomId) return json({ error: "invalid payload" }, 400, cors);
      try {
        await deleteRoom(env.DB, roomId);
        const id = env.ROOM.idFromName(roomId);
        const stub = env.ROOM.get(id);
        await stub.fetch("https://internal/delete", { method: "POST" });
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/delete-user" && request.method === "POST") {
      if (!checkAppKey(request, env)) return json({ error: "unauthorized" }, 401, cors);
      const body = await safeJson(request);
      const name = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      if (!name) return json({ error: "invalid payload" }, 400, cors);
      try {
        await deleteUser(env.DB, name);
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    // Fallback / internal — normally the RoomDO commits snapshots directly
    // (it shares this Worker's env/secrets), but this REST path exists so a
    // client that lost its socket can still force a final commit.
    if (url.pathname === "/complete-room" && request.method === "POST") {
      const body = await safeJson(request);
      const { roomId, payload } = body || {};
      if (!roomId || !payload) return json({ error: "invalid payload" }, 400, cors);
      try {
        const room = await getRoom(env.DB, roomId);
        if (!room) throw new Error("room not found");
        Object.assign(room, payload);
        await upsertRoom(env.DB, room);
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    return json({ error: "not found" }, 404, cors);
  },
};

// ===========================================================================
// RoomDO — one instance per active room.
// ===========================================================================

export class RoomDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Map(); // WebSocket -> { user }
    this.room = null; // loaded lazily from storage
    this.lastPersist = 0;
    this.deleted = false;
  }

  async loadRoom() {
    if (this.deleted) return null;
    if (this.room) return this.room;
    this.room = (await this.state.storage.get("room")) || null;
    return this.room;
  }

  async ensureRoom(roomId) {
    await this.loadRoom();
    if (this.room || !roomId) return this.room;
    const room = await getRoom(this.env.DB, roomId);
    if (!room) return null;
    this.deleted = false;
    await this.state.storage.put("room", room);
    this.room = room;
    return room;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/seed" && request.method === "POST") {
      const room = await request.json();
      this.deleted = false;
      await this.state.storage.put("room", room);
      this.room = room;
      return new Response("ok");
    }

    if (url.pathname === "/delete" && request.method === "POST") {
      this.deleted = true;
      this.broadcast({ type: "room-deleted" }, null);
      for (const socket of this.sockets.keys()) {
        try { socket.close(1000, "room deleted"); } catch (e) {}
      }
      this.sockets.clear();
      this.room = null;
      await this.state.storage.deleteAll();
      return new Response("ok");
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const roomId = url.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)\/connect$/)?.[1];
    await this.ensureRoom(roomId);
    if (!this.room) return new Response("room not found", { status: 404 });

    const user = url.searchParams.get("user") || "anonymous";
    const spectator = url.searchParams.get("spectator") === "1";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    if (!spectator && this.room && !this.room.players.includes(user)) {
      this.room.players.push(user);
      if (!this.room.pairsCleared[user]) this.room.pairsCleared[user] = 0;
      if (!this.room.streaks[user]) this.room.streaks[user] = 0;
      await this.state.storage.put("room", this.room);
    }

    this.sockets.set(server, { user, spectator });
    this.sendTo(server, { type: "init", room: this.room, presence: this.presenceList() });
    this.broadcastPresence();

    server.addEventListener("message", (evt) => this.handleMessage(server, this.sockets.get(server), evt));
    server.addEventListener("close", () => { this.sockets.delete(server); this.broadcastPresence(); });
    server.addEventListener("error", () => { this.sockets.delete(server); this.broadcastPresence(); });

    return new Response(null, { status: 101, webSocket: client });
  }

  presenceList() {
    return [...this.sockets.values()].map((v) => v.user);
  }

  broadcastPresence() {
    this.broadcast({ type: "presence", players: this.presenceList() }, null);
  }

  sendTo(socket, msg) {
    try { socket.send(JSON.stringify(msg)); } catch (e) {}
  }

  broadcast(msg, exceptSocket) {
    const payload = JSON.stringify(msg);
    for (const socket of this.sockets.keys()) {
      if (socket === exceptSocket) continue;
      try { socket.send(payload); } catch (e) {}
    }
  }

  async handleMessage(socket, metadata, evt) {
    let msg;
    try { msg = JSON.parse(evt.data); } catch (e) { return; }
    await this.loadRoom();
    if (!this.room) return;
    const user = metadata?.user || "anonymous";
    if (metadata?.spectator && msg.type !== "reaction") return; // spectators watch only

    if (msg.type === "clear-pair") {
      const { idA, idB } = msg;
      const tiles = this.room.state.tiles;
      const a = tiles.find((t) => t.id === idA);
      const b = tiles.find((t) => t.id === idB);
      // Race guard: another player may have already claimed one of these —
      // the first clear-pair to reach this DO instance wins, same rule as
      // Across's per-cell first-write-wins.
      if (!a || !b || a.face.id !== b.face.id) return;
      this.room.state.tiles = tiles.filter((t) => t.id !== idA && t.id !== idB);
      this.room.pairsCleared[user] = (this.room.pairsCleared[user] || 0) + 1;
      for (const name of Object.keys(this.room.streaks)) {
        this.room.streaks[name] = name === user ? (this.room.streaks[name] || 0) + 1 : 0;
      }
      const trayEntry = { id: `${idA}-${idB}`, face: a.face, user, at: Date.now() };
      this.room.state.tray = [trayEntry, ...this.room.state.tray].slice(0, 60);
      this.room.state.matchLog = [...(this.room.state.matchLog || []), { user, at: Date.now() }].slice(-200);

      const isComplete = this.room.state.tiles.length === 0;
      if (isComplete && !this.room.completedAt) {
        this.room.completedAt = new Date().toISOString();
        this.room.state.state = "completed";
      }
      this.broadcast({ type: "cleared", idA, idB, user, tray: trayEntry, pairsCleared: this.room.pairsCleared, streaks: this.room.streaks, completed: isComplete }, null);
      await this.persist(isComplete);
    } else if (msg.type === "assist") {
      // { kind: "hint" | "shuffle" | "undo" | "flag-stuck" }
      this.room.assistsUsed[user] = (this.room.assistsUsed[user] || 0) + 1;
      if (msg.kind === "shuffle") {
        this.room.state.tiles = shuffleTilesKeepingSolvable(this.room.state.tiles);
        this.broadcast({ type: "shuffled", tiles: this.room.state.tiles, assistsUsed: this.room.assistsUsed }, null);
      } else {
        this.broadcast({ type: "assist-used", user, kind: msg.kind, assistsUsed: this.room.assistsUsed }, null);
      }
      await this.persist(false);
    } else if (msg.type === "reaction") {
      this.broadcast({ type: "reaction", user, emoji: msg.emoji }, socket);
    } else if (msg.type === "checkpoint") {
      await this.persist(this.room.state.tiles.length === 0);
      await this.commitSnapshot(this.room.state.tiles.length === 0);
      this.sendTo(socket, { type: "checkpoint-saved", requestId: msg.requestId });
    }
  }

  async persist(completed) {
    if (this.deleted || !this.room) return;
    await this.state.storage.put("room", this.room);
    const now = Date.now();
    if (completed || now - this.lastPersist > 15000) {
      this.lastPersist = now;
      await this.commitSnapshot(completed);
    }
  }

  async commitSnapshot(completed) {
    const room = await getRoom(this.env.DB, this.room.id);
    if (!room) return;
    room.state = this.room.state;
    room.players = this.room.players;
    room.pairsCleared = this.room.pairsCleared;
    room.streaks = this.room.streaks;
    room.assistsUsed = this.room.assistsUsed;
    if (completed && !room.completedAt) {
      room.completedAt = new Date().toISOString();
      room.state.state = "completed";
    }
    await upsertRoom(this.env.DB, room);
  }
}

// ===========================================================================
// Board generation (server authority for room seeding + daily puzzle).
// Deliberately a compact standalone copy of game/mahjong.js's reverse-
// construction algorithm — the Worker is deployed as a single pasted file
// (see AGENTS.md), so it does not import across the repo boundary.
// ===========================================================================

// Colors/glyphs must match game/tiles.js exactly (INK/RED/GREEN/BLUE, and
// the kind/top/bot/color/n shape renderTileFace() expects) — a room built
// here with bare { id } faces renders as blank tiles client-side until
// something (e.g. Shuffle) regenerates them locally with the real shape.
const INK = "#23201c";
const RED = "#b5322c";
const GREEN = "#1f7a4d";
const BLUE = "#2b5f9e";
const CRAK_NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WINDS = ["東", "南", "西", "北"];
const DRAGONS = [{ glyph: "中", color: RED }, { glyph: "發", color: GREEN }, { glyph: "白", color: BLUE }];

function buildFaceSet() {
  const faces = [];
  CRAK_NUMS.forEach((n, i) => faces.push({ id: `crak${i + 1}`, kind: "char", top: n, bot: "萬", color: i % 2 ? BLUE : RED }));
  WINDS.forEach((w, i) => faces.push({ id: `wind${i}`, kind: "char", top: w, bot: "", color: INK }));
  DRAGONS.forEach((d, i) => faces.push({ id: `dragon${i}`, kind: "char", top: d.glyph, bot: "", color: d.color }));
  for (let n = 1; n <= 9; n++) faces.push({ id: `dot${n}`, kind: "dot", n, color: n % 2 ? RED : GREEN });
  for (let n = 1; n <= 9; n++) faces.push({ id: `bam${n}`, kind: "bam", n, color: GREEN });
  return faces;
}

function isFree(tile, live) {
  const above = live.some((o) => o.z === tile.z + 1 && o.x === tile.x && o.y === tile.y);
  if (above) return false;
  const l = live.some((o) => o.z === tile.z && o.y === tile.y && o.x === tile.x - 1);
  const r = live.some((o) => o.z === tile.z && o.y === tile.y && o.x === tile.x + 1);
  return !(l && r);
}

function rect(x0, x1, y0, y1, z) {
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y, z });
  return out;
}

// Mirrors game/layouts.js exactly — a room built server-side (POST
// /create-room) with a layoutId this Worker doesn't recognize silently
// falls back to dragons-nest (see validateCreateRoom), so every layout
// the client can pick has to have an entry here too.
const LAYOUT_POSITIONS = {
  "two-bridges": () => [...rect(0, 5, 0, 3, 0), ...rect(1, 4, 0, 2, 1)],
  "dragons-nest": () => [...rect(0, 7, 0, 4, 0), ...rect(2, 5, 1, 3, 1)],
  "eight-winds": () => [...rect(0, 7, 0, 4, 0), ...rect(1, 6, 1, 3, 1).filter((_, i) => i % 3 !== 2)],
  "twin-pillars": () => [...rect(0, 7, 0, 2, 0), ...rect(2, 5, 0, 1, 1)],
  "garden-gate": () => [...rect(0, 7, 0, 4, 0), ...rect(1, 6, 0, 3, 1), ...rect(3, 4, 1, 2, 2)],
  "river-bend": () => [...rect(0, 8, 0, 3, 0), ...rect(3, 6, 1, 2, 1)],
  "twin-peaks": () => [...rect(0, 7, 0, 4, 0), ...rect(1, 6, 1, 3, 1), { x: 3, y: 2, z: 2 }, { x: 4, y: 2, z: 2 }],
  "hollow-square": () => [...rect(0, 7, 0, 4, 0), ...rect(1, 6, 2, 2, 1)],
  "nine-gates": () => [...rect(0, 7, 0, 4, 0), ...rect(1, 6, 0, 3, 1), ...rect(2, 5, 1, 2, 2)],
  "diamond-court": () => [...rect(0, 7, 0, 3, 0), ...rect(1, 6, 0, 3, 1), ...rect(3, 4, 1, 2, 2)],
  "cross-gate": () => [...rect(0, 6, 0, 3, 0), ...rect(2, 4, 0, 3, 1)],
  "terraced-steps": () => [...rect(0, 7, 0, 3, 0), ...rect(1, 6, 0, 3, 1), ...rect(2, 5, 0, 3, 2), ...rect(3, 4, 0, 3, 3)],
  "long-table": () => [...rect(0, 9, 0, 3, 0), ...rect(2, 7, 0, 2, 1)],
  "four-corners": () => [...rect(0, 7, 0, 4, 0), ...rect(0, 1, 0, 1, 1), ...rect(6, 7, 3, 4, 1)],
  "serpents-coil": () => [...rect(0, 3, 0, 2, 0), ...rect(4, 7, 2, 4, 0), ...rect(1, 6, 1, 3, 1)],
  "twin-dragons": () => [...rect(0, 9, 0, 3, 0), ...rect(1, 3, 0, 3, 1), ...rect(6, 8, 0, 3, 1), { x: 4, y: 1, z: 2 }, { x: 5, y: 1, z: 2 }, { x: 4, y: 2, z: 2 }, { x: 5, y: 2, z: 2 }],
  "imperial-seal": () => [...rect(0, 8, 0, 3, 0), ...rect(1, 7, 0, 3, 1), ...rect(2, 6, 1, 2, 2), ...rect(3, 5, 1, 2, 3)],
  "phoenix-throne": () => [...rect(0, 8, 0, 3, 0), ...rect(2, 6, 0, 3, 1), ...rect(3, 5, 1, 2, 2)],
  "jade-labyrinth": () => [...rect(0, 8, 0, 3, 0), ...rect(1, 7, 0, 3, 1), ...rect(2, 6, 1, 2, 2), ...rect(3, 4, 1, 2, 3)],
  "great-wall": () => [
    ...rect(0, 13, 0, 7, 0),
    ...rect(1, 12, 1, 6, 1),
    ...rect(3, 10, 2, 5, 2),
    ...rect(5, 8, 3, 4, 3),
    { x: 6, y: 3, z: 4 },
    { x: 7, y: 3, z: 4 },
  ],
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function generateFromPositions(positions, faces, rng) {
  const remaining = positions.map((p, i) => ({ x: p.x, y: p.y, z: p.z, id: `t${i}`, face: null }));
  const placed = [];
  let faceIndex = 0;
  let guard = 0;
  const guardLimit = positions.length * 30 + 50;
  while (remaining.length >= 2 && guard++ < guardLimit) {
    const free = remaining.filter((t) => isFree(t, remaining));
    if (free.length < 2) return null;
    const a = free[Math.floor(rng() * free.length)];
    const restFree = free.filter((t) => t !== a);
    const b = restFree[Math.floor(rng() * restFree.length)];
    const face = faces[faceIndex % faces.length];
    faceIndex++;
    for (const t of [a, b]) { t.face = face; placed.push(t); remaining.splice(remaining.indexOf(t), 1); }
  }
  return remaining.length === 0 ? placed : null;
}

function generateBoard(layoutId, seed) {
  const positions = (LAYOUT_POSITIONS[layoutId] || LAYOUT_POSITIONS["dragons-nest"])();
  const faces = buildFaceSet();
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    const tiles = generateFromPositions(positions, faces, mulberry32(seed + attempt * 7919));
    if (tiles) return tiles;
  }
  throw new Error(`could not generate a solvable board for ${layoutId}`);
}

function shuffleTilesKeepingSolvable(tiles) {
  const positions = tiles.map((t) => ({ x: t.x, y: t.y, z: t.z }));
  const faces = buildFaceSet();
  for (let attempt = 0; attempt < 40; attempt++) {
    const rebuilt = generateFromPositions(positions, faces, mulberry32(Date.now() + attempt));
    if (rebuilt) {
      const faceByIndex = new Array(positions.length);
      for (const t of rebuilt) faceByIndex[Number(t.id.slice(1))] = t.face;
      return tiles.map((t, i) => ({ ...t, face: faceByIndex[i] }));
    }
  }
  return tiles;
}

// ===========================================================================
// Validation / construction
// ===========================================================================

function validateCreateRoom(body) {
  if (!body || typeof body !== "object") return null;
  const title = String(body.title || "").trim().slice(0, 60);
  const mode = ["shared", "race", "solo"].includes(body.mode) ? body.mode : "shared";
  const layoutId = Object.keys(LAYOUT_POSITIONS).includes(body.layoutId) ? body.layoutId : "dragons-nest";
  const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
  const visibility = body.visibility === "private" ? "private" : "open";
  const createdBy = String(body.createdBy || "").trim().slice(0, 40);
  const freeTilesGlow = body.freeTilesGlow !== false;
  const hintsAllowed = body.hintsAllowed !== false;
  if (!title || !createdBy) return null;
  return { title, mode, layoutId, difficulty, visibility, createdBy, freeTilesGlow, hintsAllowed };
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function buildRoom(req) {
  const id = `${slugify(req.title) || "room"}-${Date.now().toString(36)}`;
  const seed = hashSeed(id);
  const tiles = generateBoard(req.layoutId, seed);
  const room = {
    id,
    title: req.title,
    mode: req.mode,
    layoutId: req.layoutId,
    tileCount: tiles.length,
    difficulty: req.difficulty,
    visibility: req.visibility,
    createdBy: req.createdBy,
    createdAt: new Date().toISOString(),
    startedAt: Date.now(),
    freeTilesGlow: req.freeTilesGlow,
    hintsAllowed: req.hintsAllowed,
    players: [req.createdBy],
    pairsCleared: { [req.createdBy]: 0 },
    streaks: { [req.createdBy]: 0 },
    assistsUsed: {},
    state: { tiles, tray: [], matchLog: [], state: "open", seed },
    completedAt: null,
  };
  // Race mode: same layout, but each player clears their own independent
  // copy of the board. Mirrors game/room.js's buildLocalRoom() — a room
  // synced down from here without this field makes race-board.js bounce
  // straight back to home (see its `!room.racers` guard).
  if (req.mode === "race") {
    room.racers = { [req.createdBy]: { tiles: generateBoard(req.layoutId, seed + 104729) } };
  }
  return room;
}

// ===========================================================================
// Shared helpers
// ===========================================================================

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Key",
  };
}

function checkAppKey(request, env) {
  return !env.APP_KEY || request.headers.get("X-App-Key") === env.APP_KEY;
}

async function safeJson(request) {
  try { return await request.json(); } catch (e) { return null; }
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch (e) { return fallback; }
}

function userFromRow(row) {
  const defaults = { freeTilesGlow: true, hintsAllowed: true, sound: true, haptic: true };
  return { hue: row.hue, createdAt: row.created_at, settings: { ...defaults, ...parseJson(row.settings_json, defaults) } };
}

function roomFromRow(row) {
  return parseJson(row.payload_json, null);
}

async function loadData(db, scope, user) {
  const [userResult, roomResult] = await db.batch([
    db.prepare("SELECT name, hue, created_at, settings_json FROM users ORDER BY rowid"),
    db.prepare("SELECT payload_json FROM rooms ORDER BY rowid"),
  ]);
  const users = {};
  for (const row of userResult.results || []) users[row.name] = userFromRow(row);
  let rooms = (roomResult.results || []).map((row) => roomFromRow(row)).filter(Boolean);
  if (scope === "open") rooms = rooms.filter((r) => r.visibility === "open" && r.state?.state !== "completed");
  else if (scope === "mine" && user) rooms = rooms.filter((r) => (r.players || []).includes(user));
  const roomsById = {};
  for (const r of rooms) roomsById[r.id] = r;
  return { users, rooms: roomsById };
}

async function registerUser(db, name) {
  const existing = await db.prepare("SELECT name, hue, created_at, settings_json FROM users WHERE name = ?").bind(name).first();
  if (existing) return userFromRow(existing);
  const count = Number(await db.prepare("SELECT COUNT(*) AS count FROM users").first("count")) || 0;
  const createdAt = new Date().toISOString();
  const settings = { freeTilesGlow: true, hintsAllowed: true, sound: true, haptic: true };
  await db.prepare("INSERT OR IGNORE INTO users (name, hue, created_at, settings_json, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(name, PLAYER_HUES[count % PLAYER_HUES.length], createdAt, JSON.stringify(settings), createdAt).run();
  const row = await db.prepare("SELECT name, hue, created_at, settings_json FROM users WHERE name = ?").bind(name).first();
  if (!row) throw new Error("user insert failed");
  return userFromRow(row);
}

function roomUpsertStatement(db, room) {
  const now = new Date().toISOString();
  return db.prepare(`
    INSERT INTO rooms (
      id, title, mode, layout_id, tile_count, visibility, created_by,
      created_at, state, completed_at, payload_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, mode = excluded.mode, layout_id = excluded.layout_id,
      tile_count = excluded.tile_count, visibility = excluded.visibility,
      created_by = excluded.created_by, created_at = excluded.created_at,
      state = excluded.state, completed_at = excluded.completed_at,
      payload_json = excluded.payload_json, updated_at = excluded.updated_at
  `).bind(
    room.id, room.title || "", room.mode || "shared", room.layoutId || "dragons-nest",
    room.tileCount || 0, room.visibility || "open", room.createdBy || "",
    room.createdAt || now, room.state?.state || "open", room.completedAt || null,
    JSON.stringify(room), now
  );
}

async function upsertRoom(db, room) {
  await roomUpsertStatement(db, room).run();
}

async function getRoom(db, roomId) {
  const row = await db.prepare("SELECT payload_json FROM rooms WHERE id = ?").bind(roomId).first();
  return row ? roomFromRow(row) : null;
}

async function joinRoom(db, roomId, user) {
  const room = await getRoom(db, roomId);
  if (!room) throw new Error("room not found");
  if (!Array.isArray(room.players)) room.players = [];
  if (!room.players.includes(user)) room.players.push(user);
  room.pairsCleared[user] = room.pairsCleared[user] || 0;
  room.streaks[user] = room.streaks[user] || 0;
  if (room.mode === "race") {
    if (!room.racers) room.racers = {};
    if (!room.racers[user]) room.racers[user] = { tiles: generateBoard(room.layoutId, room.state.seed + Object.keys(room.racers).length * 104729) };
  }
  await upsertRoom(db, room);
}

async function deleteRoom(db, roomId) {
  await db.prepare("DELETE FROM rooms WHERE id = ?").bind(roomId).run();
}

async function deleteUser(db, name) {
  await db.prepare("DELETE FROM users WHERE name = ?").bind(name).run();
}

async function getOrCreateDaily(db) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.prepare("SELECT date, layout_id, seed FROM daily_boards WHERE date = ?").bind(today).first();
  if (existing) return { date: existing.date, layoutId: existing.layout_id, seed: existing.seed, tiles: generateBoard(existing.layout_id, existing.seed) };
  const layoutIds = Object.keys(LAYOUT_POSITIONS);
  const layoutId = layoutIds[hashSeed(today) % layoutIds.length];
  const seed = hashSeed(`daily-${today}`);
  await db.prepare("INSERT OR IGNORE INTO daily_boards (date, layout_id, seed) VALUES (?, ?, ?)").bind(today, layoutId, seed).run();
  return { date: today, layoutId, seed, tiles: generateBoard(layoutId, seed) };
}

export { loadData, registerUser, upsertRoom, getRoom, joinRoom, deleteRoom, deleteUser, buildRoom, validateCreateRoom, generateBoard, getOrCreateDaily };
