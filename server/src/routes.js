// Whispr REST API routes (async — @libsql/client)
const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { get, all, run } = require("./db");
const { signToken, authMiddleware } = require("./auth");

const router = express.Router();

// Wrap async route handlers so rejected promises reach Express error handling
// (Express 4 does not catch async errors on its own).
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- helpers ----------
const AVATAR_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];
const pickColor = (name) => AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

function publicUser(u) {
  return u ? { id: u.id, username: u.username, displayName: u.display_name, color: u.color } : null;
}

function hydrateMessage(row) {
  const msg = {
    id: row.id,
    chatType: row.circle_id ? "circle" : "dm",
    chatId: row.circle_id || row.dm_id,
    sender: publicUser({
      id: row.sender_id, username: row.sender_username,
      display_name: row.sender_display, color: row.sender_color,
    }),
    body: row.body,
    replyTo: row.reply_to ? {
      id: row.reply_to, body: row.reply_body, deleted: !!row.reply_deleted,
      senderName: row.reply_sender_name,
    } : null,
    attachment: row.attachment ? JSON.parse(row.attachment) : null,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deleted: !!row.deleted,
    reactions: [],
    receipts: [],
  };
  if (row.deleted) { msg.body = ""; msg.attachment = null; msg.replyTo = null; }
  return msg;
}

async function attachReactionsAndReceipts(messages) {
  if (!messages.length) return messages;
  const ids = messages.map((m) => m.id);
  const marks = ids.map(() => "?").join(",");
  const byId = Object.fromEntries(messages.map((m) => [m.id, m]));
  const reactions = await all(
    `SELECT r.message_id, r.emoji, u.id AS uid, u.display_name AS name
     FROM reactions r JOIN users u ON u.id = r.user_id
     WHERE r.message_id IN (${marks})`, ...ids);
  for (const r of reactions) {
    byId[r.message_id].reactions.push({ emoji: r.emoji, userId: r.uid, userName: r.name });
  }
  const receipts = await all(
    `SELECT message_id, user_id, delivered_at, read_at FROM receipts WHERE message_id IN (${marks})`,
    ...ids);
  for (const r of receipts) {
    byId[r.message_id].receipts.push({ userId: r.user_id, deliveredAt: r.delivered_at, readAt: r.read_at });
  }
  return messages;
}

const MESSAGE_SELECT = `
  SELECT m.*, u.username AS sender_username, u.display_name AS sender_display, u.color AS sender_color,
         rm.body AS reply_body, rm.deleted AS reply_deleted, ru.display_name AS reply_sender_name
  FROM messages m
  JOIN users u ON u.id = m.sender_id
  LEFT JOIN messages rm ON rm.id = m.reply_to
  LEFT JOIN users ru ON ru.id = rm.sender_id`;

async function getMessages(chatType, chatId, limit = 60, before = null) {
  const col = chatType === "circle" ? "circle_id" : "dm_id";
  let sql = `${MESSAGE_SELECT} WHERE m.${col} = ? AND m.deleted = 0`;
  const params = [chatId];
  if (before) { sql += " AND m.id < ?"; params.push(before); }
  sql += " ORDER BY m.id DESC LIMIT ?";
  params.push(limit);
  const rows = (await all(sql, ...params)).reverse();
  return attachReactionsAndReceipts(rows.map(hydrateMessage));
}

async function chatMembers(chatType, chatId) {
  if (chatType === "circle") {
    return all(
      "SELECT u.id, u.username, u.display_name AS displayName, u.color FROM circle_members cm JOIN users u ON u.id = cm.user_id WHERE cm.circle_id = ?",
      chatId
    );
  }
  const dm = await get("SELECT user_a, user_b FROM dms WHERE id = ?", chatId);
  if (!dm) return [];
  return all(
    "SELECT id, username, display_name AS displayName, color FROM users WHERE id IN (?, ?)",
    dm.user_a, dm.user_b
  );
}

async function isMember(chatType, chatId, userId) {
  if (chatType === "circle") {
    return !!(await get("SELECT 1 FROM circle_members WHERE circle_id = ? AND user_id = ?", chatId, userId));
  }
  const dm = await get("SELECT 1 AS ok FROM dms WHERE id = ? AND (user_a = ? OR user_b = ?)", chatId, userId, userId);
  return !!dm;
}

// ---------- auth ----------
router.post("/auth/register", ah(async (req, res) => {
  const { username, password, displayName } = req.body || {};
  const clean = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,20}$/.test(clean)) {
    return res.status(400).json({ error: "Username must be 3–20 chars: letters, numbers, _ or ." });
  }
  if (!password || password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });
  if (await get("SELECT 1 AS ok FROM users WHERE username = ?", clean)) {
    return res.status(409).json({ error: "That username is taken" });
  }
  const info = await run(
    "INSERT INTO users (username, display_name, password_hash, color, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)",
    clean, String(displayName || clean).trim().slice(0, 30) || clean,
    bcrypt.hashSync(password, 10), pickColor(clean), Date.now(), Date.now());
  const user = await get("SELECT * FROM users WHERE id = ?", info.lastInsertRowid);
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.post("/auth/login", ah(async (req, res) => {
  const clean = String(req.body.username || "").trim().toLowerCase();
  const user = await get("SELECT * FROM users WHERE username = ?", clean);
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password_hash)) {
    return res.status(401).json({ error: "Wrong username or password" });
  }
  await run("UPDATE users SET last_seen = ? WHERE id = ?", Date.now(), user.id);
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get("/auth/me", authMiddleware, ah(async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", req.user.id);
  if (!user) return res.status(401).json({ error: "User gone" });
  res.json({ user: publicUser(user) });
}));

router.use(authMiddleware); // everything below needs auth

// ---------- user directory ----------
router.get("/users", ah(async (req, res) => {
  const q = `%${String(req.query.q || "").trim().toLowerCase()}%`;
  const users = await all(
    "SELECT id, username, display_name, color FROM users WHERE id != ? AND (username LIKE ? OR display_name LIKE ?) ORDER BY username LIMIT 30",
    req.user.id, q, q
  );
  res.json({ users: users.map((u) => ({ id: u.id, username: u.username, displayName: u.display_name, color: u.color })) });
}));

// ---------- circles ----------
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars
async function makeCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (await get("SELECT 1 AS ok FROM circles WHERE code = ?", code));
  return code;
}

router.get("/circles", ah(async (req, res) => {
  const circles = await all(`
    SELECT c.id, c.name, c.code, c.created_at,
           (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) AS memberCount,
           (SELECT MAX(id) FROM messages WHERE circle_id = c.id AND deleted = 0) AS lastMsgId
    FROM circles c JOIN circle_members cm ON cm.circle_id = c.id
    WHERE cm.user_id = ? ORDER BY c.created_at DESC`, req.user.id);
  res.json({ circles });
}));

router.post("/circles", ah(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: "Circle needs a name" });
  const code = await makeCode();
  const now = Date.now();
  const info = await run("INSERT INTO circles (name, code, owner_id, created_at) VALUES (?, ?, ?, ?)",
    name, code, req.user.id, now);
  await run("INSERT INTO circle_members (circle_id, user_id, joined_at) VALUES (?, ?, ?)",
    info.lastInsertRowid, req.user.id, now);
  res.json({ circle: { id: info.lastInsertRowid, name, code, memberCount: 1 } });
}));

router.post("/circles/join", ah(async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  const circle = await get("SELECT * FROM circles WHERE code = ?", code);
  if (!circle) return res.status(404).json({ error: "No circle found with that code" });
  await run("INSERT OR IGNORE INTO circle_members (circle_id, user_id, joined_at) VALUES (?, ?, ?)",
    circle.id, req.user.id, Date.now());
  res.json({ circle: { id: circle.id, name: circle.name, code: circle.code } });
}));

router.get("/circles/:id/members", ah(async (req, res) => {
  if (!(await isMember("circle", req.params.id, req.user.id))) return res.status(403).json({ error: "Not a member" });
  res.json({ members: await chatMembers("circle", req.params.id) });
}));

// ---------- DMs ----------
router.get("/dms", ah(async (req, res) => {
  const dms = await all(`
    SELECT d.id, d.user_a, d.user_b,
           (SELECT MAX(id) FROM messages WHERE dm_id = d.id AND deleted = 0) AS lastMsgId
    FROM dms d WHERE d.user_a = ? OR d.user_b = ?`, req.user.id, req.user.id);
  const out = [];
  for (const d of dms) {
    const partnerId = d.user_a === req.user.id ? d.user_b : d.user_a;
    const p = await get("SELECT id, username, display_name, color FROM users WHERE id = ?", partnerId);
    out.push({ id: d.id, partner: { id: p.id, username: p.username, displayName: p.display_name, color: p.color }, lastMsgId: d.lastMsgId });
  }
  res.json({ dms: out });
}));

router.post("/dms", ah(async (req, res) => {
  const otherId = Number(req.body.userId);
  if (!otherId || otherId === req.user.id) return res.status(400).json({ error: "Pick someone else to chat with" });
  const other = await get("SELECT id FROM users WHERE id = ?", otherId);
  if (!other) return res.status(404).json({ error: "User not found" });
  const a = Math.min(req.user.id, otherId), b = Math.max(req.user.id, otherId);
  await run("INSERT OR IGNORE INTO dms (user_a, user_b, created_at) VALUES (?, ?, ?)", a, b, Date.now());
  const dm = await get("SELECT id FROM dms WHERE user_a = ? AND user_b = ?", a, b);
  res.json({ dmId: dm.id });
}));

// ---------- messages ----------
async function checkChatAccess(req, res, next) {
  const { chatType, chatId } = {
    chatType: req.params.chatType || req.body.chatType || req.query.chatType,
    chatId: Number(req.params.chatId || req.body.chatId || req.query.chatId),
  };
  if (!["circle", "dm"].includes(chatType) || !chatId) return res.status(400).json({ error: "Bad chat reference" });
  if (!(await isMember(chatType, chatId, req.user.id))) return res.status(403).json({ error: "Not a member of this chat" });
  req.chat = { chatType, chatId };
  next();
}

router.get("/messages/:chatType/:chatId", ah(checkChatAccess), ah(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  const before = req.query.before ? Number(req.query.before) : null;
  res.json({ messages: await getMessages(req.chat.chatType, req.chat.chatId, limit, before) });
}));

// search across my chats, or within one chat
router.get("/search", ah(async (req, res) => {
  const q = `%${String(req.query.q || "").trim()}%`;
  if (String(req.query.q || "").trim().length < 2) return res.json({ results: [] });
  const myCircleIds = (await all("SELECT circle_id FROM circle_members WHERE user_id = ?", req.user.id)).map((r) => r.circle_id);
  const myDmIds = (await all("SELECT id FROM dms WHERE user_a = ? OR user_b = ?", req.user.id, req.user.id)).map((r) => r.id);
  const chatType = req.query.chatType, chatId = Number(req.query.chatId);
  let where, params;
  if (chatType && chatId && await isMember(chatType, chatId, req.user.id)) {
    const col = chatType === "circle" ? "circle_id" : "dm_id";
    where = `m.${col} = ?`; params = [chatId];
  } else {
    const parts = [];
    params = [];
    if (myCircleIds.length) { parts.push(`m.circle_id IN (${myCircleIds.map(() => "?").join(",")})`); params.push(...myCircleIds); }
    if (myDmIds.length) { parts.push(`m.dm_id IN (${myDmIds.map(() => "?").join(",")})`); params.push(...myDmIds); }
    if (!parts.length) return res.json({ results: [] });
    where = `(${parts.join(" OR ")})`;
  }
  const rows = await all(
    `${MESSAGE_SELECT} WHERE ${where} AND m.deleted = 0 AND m.body LIKE ? ORDER BY m.id DESC LIMIT 30`,
    ...params, q);
  res.json({ results: await attachReactionsAndReceipts(rows.map(hydrateMessage)) });
}));

router.delete("/messages/:id", ah(async (req, res) => {
  const msg = await get("SELECT * FROM messages WHERE id = ?", req.params.id);
  if (!msg) return res.status(404).json({ error: "Message not found" });
  const chatType = msg.circle_id ? "circle" : "dm";
  const chatId = msg.circle_id || msg.dm_id;
  if (!(await isMember(chatType, chatId, req.user.id))) return res.status(403).json({ error: "Not allowed" });
  const owner = msg.circle_id
    ? (await get("SELECT owner_id FROM circles WHERE id = ?", msg.circle_id)).owner_id === req.user.id
    : false;
  if (msg.sender_id !== req.user.id && !owner) return res.status(403).json({ error: "You can only delete your own messages" });
  await run("UPDATE messages SET deleted = 1, body = '', attachment = NULL WHERE id = ?", msg.id);
  await run("DELETE FROM reactions WHERE message_id = ?", msg.id);
  // notify via socket layer hook (set by index.js)
  if (router.onMessageDeleted) router.onMessageDeleted(chatType, chatId, msg.id);
  res.json({ ok: true });
}));

// ---------- mood themes ----------
router.get("/themes", ah(async (req, res) => {
  const rows = await all("SELECT chat_key, theme FROM chat_themes WHERE user_id = ?", req.user.id);
  res.json({ themes: Object.fromEntries(rows.map((r) => [r.chat_key, r.theme])) });
}));
router.put("/themes", ah(async (req, res) => {
  const { chatKey, theme } = req.body || {};
  if (!chatKey || !["midnight", "sunset", "forest", "candy"].includes(theme)) {
    return res.status(400).json({ error: "Bad theme" });
  }
  await run("INSERT INTO chat_themes (user_id, chat_key, theme) VALUES (?, ?, ?) ON CONFLICT(user_id, chat_key) DO UPDATE SET theme = excluded.theme",
    req.user.id, chatKey, theme);
  res.json({ ok: true });
}));

// ---------- uploads ----------
const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).slice(0, 10)}`;
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    // block executables / scripts, allow everything else
    if (/\.(exe|bat|cmd|sh|msi|apk|dmg)$/i.test(file.originalname)) return cb(new Error("That file type is blocked"));
    cb(null, true);
  },
});

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received" });
  const isImage = req.file.mimetype.startsWith("image/");
  res.json({
    file: {
      kind: isImage ? "image" : "file",
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname.slice(0, 80),
      size: req.file.size,
      mime: req.file.mimetype,
    },
  });
});

module.exports = { router, getMessages, chatMembers, isMember, hydrateMessage, attachReactionsAndReceipts };
