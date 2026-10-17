// Whispr DB layer — @libsql/client (SQLite-compatible, local file OR Turso)
//
// Local/dev (zero-config, no account needed — exactly like v1):
//   DATABASE_URL=file:./data/whispr.db        (this is the default, just run it)
// Production (Turso free tier, no credit card — see DEPLOY.md):
//   DATABASE_URL=libsql://your-db-username.turso.io
//   DATABASE_AUTH_TOKEN=<token from `turso db tokens create whispr`>
//
// The helpers below (get/all/run) mirror the old better-sqlite3 call shapes
// so the rest of the code reads the same — they are just async now.
const path = require("path");
const fs = require("fs");
const { createClient } = require("@libsql/client");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(DATA_DIR, "whispr.db")}`;

const db = createClient({
  url: DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

// libsql can hand back BigInt for integer columns — normalize to Number
// so the rest of the app (and JSON responses) keeps working with plain numbers.
function normalizeRow(row) {
  for (const key of Object.keys(row)) {
    if (typeof row[key] === "bigint") row[key] = Number(row[key]);
  }
  return row;
}

async function get(sql, ...args) {
  const rs = await db.execute({ sql, args });
  return rs.rows.length ? normalizeRow(rs.rows[0]) : null;
}

async function all(sql, ...args) {
  const rs = await db.execute({ sql, args });
  return rs.rows.map(normalizeRow);
}

async function run(sql, ...args) {
  const rs = await db.execute({ sql, args });
  return {
    lastInsertRowid: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : null,
    changes: Number(rs.rowsAffected || 0),
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,          -- lowercased
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',  -- avatar accent color
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS circles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,              -- 6-char invite code
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS dms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- lower id first
  user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER REFERENCES circles(id) ON DELETE CASCADE,
  dm_id INTEGER REFERENCES dms(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  reply_to INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  attachment TEXT,                        -- JSON: { kind:'image'|'file', url, name, size }
  expires_at INTEGER,                     -- whisper-mode self-destruct timestamp (ms)
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted INTEGER NOT NULL DEFAULT 0,
  CHECK ((circle_id IS NULL) <> (dm_id IS NULL))
);

CREATE TABLE IF NOT EXISTS reactions (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

-- per-recipient delivery/read receipts
CREATE TABLE IF NOT EXISTS receipts (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- the recipient
  delivered_at INTEGER,
  read_at INTEGER,
  PRIMARY KEY (message_id, user_id)
);

-- per-user mood theme per chat: chat_key like 'dm:7' or 'circle:12'
CREATE TABLE IF NOT EXISTS chat_themes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_key TEXT NOT NULL,
  theme TEXT NOT NULL,
  PRIMARY KEY (user_id, chat_key)
);

CREATE INDEX IF NOT EXISTS idx_msg_circle ON messages(circle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_dm ON messages(dm_id, created_at);
`;

async function initDb() {
  if (DATABASE_URL.startsWith("file:")) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // Pragmas are a local-file concern; Turso manages its own storage engine.
    try { await db.execute("PRAGMA journal_mode = WAL"); } catch { /* ignore */ }
    try { await db.execute("PRAGMA foreign_keys = ON"); } catch { /* ignore */ }
  }
  await db.executeMultiple(SCHEMA);
  // Clean up any whisper messages whose timer expired while the server was down
  const wiped = await run(
    "UPDATE messages SET deleted = 1 WHERE deleted = 0 AND expires_at IS NOT NULL AND expires_at <= ?",
    Date.now()
  );
  if (wiped.changes > 0) console.log(`[db] cleaned ${wiped.changes} expired whisper message(s)`);
  console.log(`[db] ready (${DATABASE_URL.startsWith("file:") ? "local file" : "remote libsql"})`);
}

module.exports = { db, get, all, run, initDb, DATABASE_URL };
