# HOW TO RUN Whispr 🟣 (v2)

5 steps. ~5 minutes. Works on Windows, Mac, and Linux.

> **New in v2:** chat with friends in **different towns** — deploy your own public
> link for free (no credit card). See **["Use it over the internet"](#use-it-over-the-internet-)** below,
> or the full click-by-click guide in [DEPLOY.md](DEPLOY.md). Running at home is
> unchanged: no account or setup needed.

---

## Step 1 — Install Node.js

You need **Node.js 18 or newer**. Check:

```bash
node --version
```

If it's missing or older, install the LTS from <https://nodejs.org>.

---

## Step 2 — Install dependencies

Open a terminal **inside the unzipped `whispr` folder**, then:

```bash
cd server
npm install
cd ../client
npm install
cd ..
```

> `npm install` in `server/` compiles the SQLite driver — needs ~30 seconds
> and an internet connection the first time.

---

## Step 3 — Set your secret (one time)

```bash
cd server
cp .env.example .env
```

Open `.env` and replace `change-this-to-a-long-random-string` with any long
random text, e.g. `whispr-my-secret-9f3k2j`. Save. (Never share this file.)

---

## Step 4 — Build the app once

```bash
cd ../client
npm run build
cd ..
```

This creates `client/dist/` — the finished app the server will serve.

---

## Step 5 — Start Whispr 🚀

```bash
cd server
npm start
```

You should see:

```
[whispr] serving built client from …/client/dist
[whispr] server listening on http://0.0.0.0:5000
```

Open **http://localhost:5000** in your browser → **Sign up** → you're in.
The database file is created automatically at `server/data/whispr.db`
(zero-config local SQLite — no Turso account needed for home use).

To stop: `Ctrl + C`.

---

## Use it over the internet 🌍 (friends in different towns)

Your computer at home can't be reached from another town — so v2 deploys Whispr
to a free public server instead. You get a link like
`https://whispr-ab12.onrender.com` that your friend opens from their own home.

**[DEPLOY.md](DEPLOY.md)** has the exact click-by-click steps (~20 min, ₹0, no credit card):
1. Free Turso database (your chat history lives here — survives restarts)
2. Push the code to GitHub
3. Render Blueprint deploy with 2 pasted secrets → you get a public link
4. Share the link + your Circle's 6-character code with your friend

Heads-up: Render's free tier sleeps after ~15 min idle (wakes in ~30s on first
visit — DEPLOY.md shows the free fix), and uploaded images/files live on
temporary disk on the free tier (chat *text* is safe in Turso forever).

---

## Inviting friends on the same Wi-Fi 📱

1. Make sure your friends are on the **same Wi-Fi** as your computer.
2. Find your computer's LAN IP:
   - Windows: `ipconfig` → look for `IPv4 Address` (e.g. `192.168.1.5`)
   - Mac/Linux: `ifconfig` or `ip addr` (e.g. `192.168.1.5`)
3. Friends open **`http://192.168.1.5:5000`** (your IP, port 5000) on their
   phone/laptop browser → they **Sign up** with their own username.
4. Back in your Whispr: tap **＋ → New circle**, name it, and share the
   **6-character code** (tap it to copy). They tap **＋ → Join** and enter it.
5. For 1:1 chats: **＋ → Direct** → search their username → start chatting.

> If a friend's browser can't reach you, allow Node.js through your firewall
> (Windows: "Allow an app through firewall" → Node.js → Private network).

---

## How the headline features work

| Feature | How to use |
|---|---|
| 🔑 Circles | ＋ → **New circle** → share the code · ＋ → **Join** → enter a code |
| 💬 Direct messages | ＋ → **Direct** → search a username |
| ⏳ Whisper mode | In the message box, change the **Off** dropdown to **10s / 1m / 1h** before sending — the bubble shows a live countdown, then vanishes everywhere |
| 📳 Nudge | The 📳 button next to Send — shakes + buzzes everyone's open chat window |
| 😊 Reactions | Hover a bubble → **⋯** → **React**, or tap an existing reaction to toggle |
| ↩️ Reply / ✏️ Edit / 🗑️ Delete | Hover a bubble → **⋯** |
| 🎨 Mood bubbles | 🎨 in the chat header → Midnight / Sunset / Forest / Candy (saved per chat) |
| 🔍 Search | 🔍 in the chat header → type → tap a result to jump to it |
| ✓✓ Read receipts | Your messages show ✓ sent, ✓✓ delivered, **blue ✓✓** read |
| 🟢 Presence | Green dot = online now; otherwise "last seen …" under their name |

---

## Developer mode (optional)

Run frontend and backend separately with hot-reload:

```bash
# terminal 1
cd server && npm run dev
# terminal 2
cd client && npm run dev   # opens http://localhost:5173, proxies API to :5000
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `JWT_SECRET` warning / logins act weird | You skipped Step 3 — create `server/.env` |
| Friend can't open the page | Same Wi-Fi? Correct IP? Firewall allowing Node.js? |
| Port 5000 busy | Set `PORT=5001` in `server/.env`, rebuild not needed, open `:5001` |
| Want a fresh start | Stop server, delete `server/data/` and `server/uploads/`, start again |
| `npm install` fails in server | Needs build tools for SQLite: Windows → install "Build Tools for Visual Studio"; Mac → `xcode-select --install`; Linux → `sudo apt install build-essential python3` |
