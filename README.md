# Whispr — private circles 💬

A real-time private messaging web app for you and your friends. No sign-up walls, no cloud —
you host it, you own the chats.

**What makes it Whispr**
- 🔑 **Circles** — invite-only group spaces joined with a 6-character code
- ⏳ **Whisper mode** — any message can self-destruct after 10s / 1m / 1h
- 📳 **Nudge** — buzz a friend's chat window (shake + sound)
- 🎨 **Mood bubbles** — Midnight, Sunset, Forest, Candy theme per chat
- ⚡ **Truly real-time** — Socket.io: instant delivery, typing indicators, online presence,
  read receipts (✓ sent · ✓✓ delivered · blue ✓✓ read), emoji reactions, replies, edit/delete

Plus: 1:1 DMs, user directory, image/file sharing (10 MB), in-chat search, unread badges,
date dividers, new-message pill, light/dark mode (OS-first, no flash), mobile-friendly.

## Stack

| Layer | Tech |
|---|---|
| Real-time | Socket.io 4 (WebSocket) |
| Backend | Node.js 18+ · Express 4 |
| Database | libSQL via @libsql/client — local file by default, Turso in production (both SQLite-compatible) |
| Auth | JWT (30-day) + bcryptjs |
| Uploads | multer → local `server/uploads/` |
| Frontend | React 18 · Vite 5 · TailwindCSS 3 · date-fns |

One repo, two folders: `server/` and `client/`. No microservices.

## Quick start

See **[HOW_TO_RUN.md](./HOW_TO_RUN.md)** — 5 steps, ~5 minutes, including how friends
on the same Wi-Fi join from their phones.

**Friends in different towns?** See **[DEPLOY.md](./DEPLOY.md)** — free public link
(Render + Turso, no credit card), chat history survives restarts.

## Project layout

```
whispr/
├── server/
│   ├── src/
│   │   ├── index.js    # Express + Socket.io: presence, messaging, receipts, whispers
│   │   ├── db.js       # schema (local file by default, Turso in production)
│   │   ├── auth.js     # JWT helpers (REST + socket middleware)
│   │   └── routes.js   # REST: auth, users, circles, DMs, messages, search, upload, themes
│   ├── uploads/        # shared files land here (created automatically)
│   ├── data/           # whispr.db lives here (created automatically)
│   └── .env.example    # copy to .env and set a real JWT_SECRET
├── client/
│   ├── src/
│   │   ├── main.jsx    # entry + window.__whispr version stamp
│   │   ├── store.jsx   # global state + all Socket.io wiring
│   │   ├── api.js      # REST helper
│   │   ├── socket.js   # socket.io singleton
│   │   ├── components/ # Sidebar, ChatWindow, MessageBubble, Composer, EmojiPicker, …
│   │   └── pages/AuthPage.jsx
│   └── index.html      # <!-- Whispr v3 ... --> stamp on line 2
├── README.md
├── HOW_TO_RUN.md   # run at home (5 steps)
├── DEPLOY.md       # public link for friends in other towns (Render + Turso, free)
├── Dockerfile      # multi-stage build for Render
├── render.yaml     # Render blueprint (free web service)
└── .dockerignore
└── HOW_TO_RUN.md
```

## Version

**Whispr v3** — verify any deployment in seconds:
- View page source → line 2: `<!-- Whispr v3 — private circles. … -->`
- Browser console → `window.__whispr.version` → `1`

## Notes for the curious (interview-ready)

- **Optimistic UI**: the bubble renders instantly with a temp id; the server echoes
  `clientTempId` back on broadcast and the client swaps it for the real message. Failed
  sends show "tap to retry".
- **Receipts**: a `receipts` row per (message, recipient) tracks `delivered_at`/`read_at`.
  Online recipients get `delivered_at` on send; offline ones on reconnect; `read_at` when
  the chat is viewed. Ticks derive from these rows — no polling.
- **Whispers**: server-side `setTimeout` per message + a startup sweep re-arms timers and
  wipes anything that expired while the server was down.
- **Presence**: `userId → socket set` map; `last_seen` persisted on disconnect; presence
  events fan out only to people who share a chat with you.
- **LAN mode**: the Express server also serves the built client (`client/dist`), so one
  port (5000) serves app + API + sockets + uploads — friends just open `http://<your-ip>:5000`.

## Security notes (it's a friends-and-family app)

- Change `JWT_SECRET` to a long random string before sharing the link.
- It's HTTP on your LAN — fine for home Wi-Fi, don't expose it to the internet as-is.
- Blocked upload types: executables (`.exe/.bat/.sh/.apk`…); 10 MB cap.
