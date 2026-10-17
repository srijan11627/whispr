// Whispr server — Express REST + Socket.io real-time (v2: @libsql/client, proxy-ready)
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { get, all, run, initDb } = require("./db");
const { socketAuth } = require("./auth");
const { router, getMessages, chatMembers, isMember, hydrateMessage, attachReactionsAndReceipts } = require("./routes");

const PORT = Number(process.env.PORT) || 5000;
// Comma-separated allowed origins. "*" = allow any (recommended: simplest for
// Render deploys and LAN play; safe here because auth is JWT-based, not cookies).
// Requests with no Origin header (curl, node clients) are always allowed.
const CLIENT_URLS = (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean);
const allowAllOrigins = CLIENT_URLS.includes("*");

const app = express();
app.set("trust proxy", 1); // running behind Render / nginx / etc.

// NOTE: both Express `cors` and Socket.io call this as (originString, callback)
// — NOT (req, callback). `origin` is undefined for non-browser clients.
function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true); // curl, node, native sockets, same-origin navigations
  if (allowAllOrigins || CLIENT_URLS.includes(origin)) return callback(null, true);
  callback(null, false); // browser from an unlisted origin: no CORS headers
}

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
// health check BEFORE the router: the router enforces JWT auth on everything,
// and Render's health checker (plus humans) must reach this without a token.
app.get("/api/health", (req, res) => res.json({ ok: true, app: "whispr", v: 2 }));
app.use("/api", router);

// Single-port mode: serve the built client so friends just open the public URL
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (req, res) =>
    res.sendFile(path.join(clientDist, "index.html")));
  console.log("[whispr] serving built client from", clientDist);
}

// JSON error handler (also catches async route errors via the ah() wrapper)
app.use((err, req, res, next) => {
  console.error("[api]", err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  const status = /blocked|too large|LIMIT/i.test(err && err.message ? err.message : "") ? 400 : 500;
  res.status(status).json({ error: (err && err.message) || "Something went wrong" });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOrigin }, maxHttpBufferSize: 1e6 });

// catch async errors inside socket handlers (an unhandled rejection would crash Node 24)
const safe = (fn) => (...args) => Promise.resolve(fn(...args)).catch((e) => console.error("[socket]", e));

// ---- presence: userId -> Set of socket ids ----
const online = new Map(); // userId -> Set<socketId>
const socketUser = new Map(); // socketId -> userId
const roomOf = (chatType, chatId) => `${chatType}:${chatId}`;

async function broadcastPresence(userId) {
  const u = await get("SELECT id, username, display_name FROM users WHERE id = ?", userId);
  const lastSeenRow = await get("SELECT last_seen FROM users WHERE id = ?", userId);
  const payload = { userId, online: online.has(userId), lastSeen: u && lastSeenRow ? lastSeenRow.last_seen : 0 };
  // notify everyone who shares any chat with this user
  const circleIds = (await all("SELECT circle_id FROM circle_members WHERE user_id = ?", userId)).map((r) => r.circle_id);
  const dmIds = (await all("SELECT id FROM dms WHERE user_a = ? OR user_b = ?", userId, userId)).map((r) => r.id);
  const targets = new Set();
  for (const cid of circleIds) for (const m of await chatMembers("circle", cid)) targets.add(m.id);
  for (const did of dmIds) for (const m of await chatMembers("dm", did)) targets.add(m.id);
  for (const t of targets) {
    const socks = online.get(t);
    if (socks) for (const s of socks) io.to(s).emit("presence", payload);
  }
}

async function setOnline(userId, socketId, isOn) {
  let set = online.get(userId);
  if (isOn) {
    if (!set) { set = new Set(); online.set(userId, set); }
    set.add(socketId);
  } else if (set) {
    set.delete(socketId);
    if (!set.size) {
      online.delete(userId);
      await run("UPDATE users SET last_seen = ? WHERE id = ?", Date.now(), userId);
    }
  }
  const became = (isOn && set && set.size === 1) || (!isOn && !online.has(userId));
  if (became) await broadcastPresence(userId);
}
const isOnline = (userId) => online.has(userId);

function userSockets(userId) {
  const set = online.get(userId);
  return set ? [...set] : [];
}

function emitToUser(userId, event, data) {
  for (const s of userSockets(userId)) io.to(s).emit(event, data);
}

// ---- whisper expiry timers ----
const whisperTimers = new Map();
function scheduleWhisper(messageId, chatType, chatId, expiresAt) {
  const delay = Math.max(0, expiresAt - Date.now());
  clearTimeout(whisperTimers.get(messageId));
  const t = setTimeout(safe(async () => {
    whisperTimers.delete(messageId);
    const msg = await get("SELECT deleted FROM messages WHERE id = ?", messageId);
    if (msg && !msg.deleted) {
      await run("UPDATE messages SET deleted = 1, body = '', attachment = NULL WHERE id = ?", messageId);
      await run("DELETE FROM reactions WHERE message_id = ?", messageId);
      io.to(roomOf(chatType, chatId)).emit("message-deleted", { chatType, chatId, messageId });
    }
  }), delay);
  whisperTimers.set(messageId, t);
}

// ---- REST delete hook -> socket broadcast ----
router.onMessageDeleted = (chatType, chatId, messageId) => {
  io.to(roomOf(chatType, chatId)).emit("message-deleted", { chatType, chatId, messageId });
};

// ---- message insert (shared) ----
async function insertMessage({ chatType, chatId, senderId, body, replyTo, attachment, expiresIn }) {
  const col = chatType === "circle" ? "circle_id" : "dm_id";
  const other = chatType === "circle" ? "dm_id" : "circle_id";
  const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;
  const info = await run(
    `INSERT INTO messages (${col}, ${other}, sender_id, body, reply_to, attachment, expires_at, created_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
    chatId, senderId, body || "", replyTo || null,
    attachment ? JSON.stringify(attachment) : null, expiresAt, Date.now());
  const id = info.lastInsertRowid;
  // seed receipts for every other member
  const members = (await chatMembers(chatType, chatId)).filter((m) => m.id !== senderId);
  for (const m of members) await run("INSERT OR IGNORE INTO receipts (message_id, user_id) VALUES (?, ?)", id, m.id);
  if (expiresAt) scheduleWhisper(id, chatType, chatId, expiresAt);
  return id;
}

async function fullMessage(messageId) {
  const row = await get(
    `SELECT m.*, u.username AS sender_username, u.display_name AS sender_display, u.color AS sender_color,
            rm.body AS reply_body, rm.deleted AS reply_deleted, ru.display_name AS reply_sender_name
     FROM messages m JOIN users u ON u.id = m.sender_id
     LEFT JOIN messages rm ON rm.id = m.reply_to
     LEFT JOIN users ru ON ru.id = rm.sender_id
     WHERE m.id = ?`, messageId);
  if (!row) return null;
  const [msg] = await attachReactionsAndReceipts([hydrateMessage(row)]);
  return msg;
}

// ================= SOCKET.IO =================
io.use(socketAuth);

io.on("connection", safe(async (socket) => {
  const userId = socket.user.id;
  const me = await get("SELECT display_name FROM users WHERE id = ?", userId);
  const displayName = me ? me.display_name : socket.user.username;
  socketUser.set(socket.id, userId);
  await setOnline(userId, socket.id, true);
  console.log(`[socket] ${socket.user.username} connected (${socket.id})`);

  // mark pending messages as delivered for this user
  await run(`
    UPDATE receipts SET delivered_at = COALESCE(delivered_at, ?)
    WHERE user_id = ? AND delivered_at IS NULL
      AND message_id IN (SELECT id FROM messages WHERE deleted = 0)
  `, Date.now(), userId);
  // tell senders their messages got delivered
  const pending = await all(`
    SELECT r.message_id, m.sender_id, m.circle_id, m.dm_id FROM receipts r
    JOIN messages m ON m.id = r.message_id
    WHERE r.user_id = ? AND r.delivered_at IS NOT NULL AND r.read_at IS NULL`, userId);
  const bySender = new Map();
  for (const p of pending) {
    if (!bySender.has(p.sender_id)) bySender.set(p.sender_id, []);
    bySender.get(p.sender_id).push({
      messageId: p.message_id,
      chatType: p.circle_id ? "circle" : "dm",
      chatId: p.circle_id || p.dm_id,
    });
  }
  for (const [senderId, list] of bySender) emitToUser(senderId, "delivered", { items: list });

  socket.on("join-chat", safe(async ({ chatType, chatId }) => {
    if (!["circle", "dm"].includes(chatType) || !chatId) return;
    if (!(await isMember(chatType, chatId, userId))) return;
    socket.join(roomOf(chatType, chatId));
  }));
  socket.on("leave-chat", ({ chatType, chatId }) => socket.leave(roomOf(chatType, chatId)));

  // ---- send message ----
  socket.on("send-message", safe(async (payload, ack) => {
    try {
      const { chatType, chatId, body, replyTo, attachment, expiresIn } = payload || {};
      if (!["circle", "dm"].includes(chatType) || !chatId) return ack && ack({ error: "Bad chat" });
      if (!(await isMember(chatType, chatId, userId))) return ack && ack({ error: "Not a member" });
      const text = String(body || "").trim().slice(0, 4000);
      if (!text && !attachment) return ack && ack({ error: "Empty message" });
      if (expiresIn && ![10, 60, 3600].includes(Number(expiresIn))) return ack && ack({ error: "Bad whisper timer" });

      const id = await insertMessage({
        chatType, chatId, senderId: userId, body: text,
        replyTo: replyTo || null, attachment: attachment || null,
        expiresIn: expiresIn ? Number(expiresIn) : null,
      });
      const msg = await fullMessage(id);
      msg.clientTempId = (payload && payload.clientTempId) || null; // lets sender swap the optimistic bubble

      // delivered = recipient currently online (has socket); mark for all others when they connect
      const members = (await chatMembers(chatType, chatId)).filter((m) => m.id !== userId);
      const now = Date.now();
      const deliveredItems = [];
      for (const m of members) {
        if (isOnline(m.id)) {
          await run("UPDATE receipts SET delivered_at = COALESCE(delivered_at, ?) WHERE message_id = ? AND user_id = ?",
            now, id, m.id);
          deliveredItems.push({ messageId: id, chatType, chatId, userId: m.id });
        }
      }
      io.to(roomOf(chatType, chatId)).emit("new-message", msg);
      if (deliveredItems.length) socket.emit("delivered", { items: deliveredItems });
      ack && ack({ ok: true, message: msg });
    } catch (e) {
      console.error("[send-message]", e);
      ack && ack({ error: "Failed to send" });
    }
  }));

  // ---- typing ----
  socket.on("typing-start", safe(async ({ chatType, chatId }) => {
    if (!(await isMember(chatType, chatId, userId))) return;
    socket.to(roomOf(chatType, chatId)).emit("typing", { chatType, chatId, userId, name: displayName, typing: true });
  }));
  socket.on("typing-stop", ({ chatType, chatId }) => {
    socket.to(roomOf(chatType, chatId)).emit("typing", { chatType, chatId, userId, typing: false });
  });

  // ---- read receipts: mark everything in chat up to messageId as read ----
  socket.on("mark-read", safe(async ({ chatType, chatId, upTo }) => {
    if (!(await isMember(chatType, chatId, userId))) return;
    const col = chatType === "circle" ? "circle_id" : "dm_id";
    const now = Date.now();
    await run(`
      UPDATE receipts SET read_at = COALESCE(read_at, ?)
      WHERE user_id = ? AND read_at IS NULL
        AND message_id IN (SELECT id FROM messages WHERE ${col} = ? AND id <= ? AND deleted = 0)
    `, now, userId, chatId, upTo || Number.MAX_SAFE_INTEGER);
    // notify the chat room so senders update ticks
    io.to(roomOf(chatType, chatId)).emit("read-update", { chatType, chatId, userId, name: displayName, upTo: upTo || 0, at: now });
  }));

  // ---- reactions (toggle) ----
  socket.on("react", safe(async ({ messageId, emoji }) => {
    const msg = await get("SELECT * FROM messages WHERE id = ?", messageId);
    if (!msg || msg.deleted) return;
    const chatType = msg.circle_id ? "circle" : "dm";
    const chatId = msg.circle_id || msg.dm_id;
    if (!(await isMember(chatType, chatId, userId))) return;
    const exists = await get("SELECT 1 AS ok FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
      messageId, userId, emoji);
    if (exists) await run("DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?", messageId, userId, emoji);
    else await run("INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)", messageId, userId, emoji);
    io.to(roomOf(chatType, chatId)).emit("reaction-update", {
      chatType, chatId, messageId, emoji, userId, userName: displayName, added: !exists,
    });
  }));

  // ---- edit ----
  socket.on("edit-message", safe(async ({ messageId, body }, ack) => {
    try {
      const msg = await get("SELECT * FROM messages WHERE id = ?", messageId);
      if (!msg || msg.sender_id !== userId || msg.deleted) return ack && ack({ error: "Can't edit" });
      const text = String(body || "").trim().slice(0, 4000);
      if (!text) return ack && ack({ error: "Empty" });
      const now = Date.now();
      await run("UPDATE messages SET body = ?, edited_at = ? WHERE id = ?", text, now, messageId);
      const chatType = msg.circle_id ? "circle" : "dm";
      io.to(roomOf(chatType, msg.circle_id || msg.dm_id)).emit("message-edited", { messageId, body: text, editedAt: now });
      ack && ack({ ok: true });
    } catch (e) {
      console.error("[edit-message]", e);
      ack && ack({ error: "Failed to edit" });
    }
  }));

  // ---- nudge ----
  socket.on("nudge", safe(async ({ chatType, chatId }) => {
    if (!(await isMember(chatType, chatId, userId))) return;
    socket.to(roomOf(chatType, chatId)).emit("nudged", { chatType, chatId, fromId: userId, fromName: displayName, at: Date.now() });
  }));

  // ---- request presence snapshot for a chat ----
  socket.on("get-presence", safe(async ({ chatType, chatId }, ack) => {
    if (!(await isMember(chatType, chatId, userId))) return ack && ack({ error: "no" });
    const members = await chatMembers(chatType, chatId);
    const out = [];
    for (const m of members) {
      const row = await get("SELECT last_seen FROM users WHERE id = ?", m.id);
      out.push({ ...m, online: isOnline(m.id), lastSeen: row ? row.last_seen : 0 });
    }
    ack && ack({ members: out });
  }));

  socket.on("disconnect", safe(async () => {
    socketUser.delete(socket.id);
    await setOnline(userId, socket.id, false);
    console.log(`[socket] ${socket.user.username} disconnected`);
  }));
}));

async function main() {
  await initDb();
  // re-arm timers for whispers that survived a restart
  const pending = await all(
    "SELECT id, circle_id, dm_id, expires_at FROM messages WHERE deleted = 0 AND expires_at IS NOT NULL AND expires_at > ?",
    Date.now());
  for (const m of pending) {
    scheduleWhisper(m.id, m.circle_id ? "circle" : "dm", m.circle_id || m.dm_id, m.expires_at);
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[whispr] server listening on http://0.0.0.0:${PORT}`);
  });
}

main().catch((e) => {
  console.error("[whispr] failed to start:", e);
  process.exit(1);
});
