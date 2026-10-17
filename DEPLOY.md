# DEPLOY Whispr to the internet 🌍 (free, no credit card)

Chat with friends from **different towns** — your Whispr gets a public link like
`https://whispr-xxxx.onrender.com` that anyone can open. Chat history is stored in
**Turso** (free SQLite-in-the-cloud, no credit card), so it survives restarts.

Total cost: **₹0**. Time: ~20 minutes, most of it waiting for the first deploy.

---

## Step 1 — Create the free cloud database (Turso)

Turso's free tier needs **no credit card**. On your computer (Windows: use Git Bash
or WSL; Mac/Linux: terminal):

```bash
# 1. install the Turso CLI
curl -sSfL https://get.tur.so/install.sh | sh

# 2. sign up / log in (opens your browser once)
turso auth signup

# 3. create the database (pick the region closest to you when asked — e.g. Mumbai/BOM is "bom")
turso db create whispr

# 4. copy these two values — you need them in Step 3
turso db show whispr --url
turso db tokens create whispr
```

Write down:
- `DATABASE_URL` → the `libsql://...` URL from the first command
- `DATABASE_AUTH_TOKEN` → the long token from the second command

> Keep the token private — it's the password to your database.

---

## Step 2 — Push this code to GitHub

```bash
cd whispr
git init
git add .
git commit -m "Whispr v2"
# create an empty repo named "whispr" at github.com/new, then:
git remote add origin https://github.com/YOUR-USERNAME/whispr.git
git push -u origin main
```

> A `.gitignore` is included — `.env`, `data/`, `uploads/` and `node_modules` will
> never be committed. Only `.env.example` ships with the repo.

---

## Step 3 — Deploy on Render (free, no credit card)

1. Go to **https://dashboard.render.com** → sign up with your GitHub account (free tier, no card).
2. Click **New → Blueprint** → connect your `whispr` repo → Render reads `render.yaml` and shows one web service.
3. Click **Apply**. On the service page, go to **Environment** and set:
   - `DATABASE_URL` → paste the `libsql://...` URL from Step 1
   - `DATABASE_AUTH_TOKEN` → paste the token from Step 1
   - (`JWT_SECRET` is auto-generated, `CLIENT_URL` and `PORT` are pre-filled — leave them.)
4. Click **Save Changes** → Render builds the Docker image (~3–5 min the first time).
5. When it says **Live**, open the URL at the top (e.g. `https://whispr-ab12.onrender.com`).

**First run checklist:**
- Open `/api/health` on your URL — you should see `{"ok":true,"app":"whispr","v":2}`.
- Sign up with your username, create a Circle (＋ → New circle), and share **the public link + the 6-character circle code** with your friend.
- Your friend opens the link on their phone/laptop, signs up, taps ＋ → Join, enters the code — you're chatting, town-to-town. 💬

---

## Step 4 — Keep it healthy (optional, 2 minutes)

Render's free tier **sleeps after ~15 minutes of no traffic**. The first message after
sleep takes ~30–50 seconds to wake the server — after that it's instant again.

If you want it to never sleep, use a free uptime pinger (e.g. UptimeRobot's free plan):
add an HTTP monitor pointed at `https://your-app.onrender.com/api/health` every 5 minutes.
That counts as traffic and keeps it awake.

---

## Honest caveats (read before you rely on this)

| Thing | Truth |
|---|---|
| Chat **text** history | ✅ Safe — lives in Turso, survives restarts and redeploys. |
| Uploaded **images/files** | ⚠️ Live on Render's **ephemeral disk** on the free tier — they disappear when the service restarts/redeploys. Text chat is unaffected. (Future upgrade: Cloudinary/S3 — deliberately not in v2.) |
| Free-tier sleep | 💤 Sleeps after ~15 min idle; ~30–50s cold start. See Step 4 for the free fix. |
| HTTPS | ✅ Render gives you `https://` automatically — logins and chats are encrypted. |
| Who can join | Anyone with your link can **sign up** — share it only with friends. Circles add a second gate (invite code). |

---

## Running it locally (unchanged from v1)

Local mode still uses a **zero-config file database** — no Turso account needed at home.
See [HOW_TO_RUN.md](HOW_TO_RUN.md). The same code serves both: `DATABASE_URL` unset (or
`file:...`) → local file; `libsql://...` → Turso.
