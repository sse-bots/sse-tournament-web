# SSE Tournament Web v4.0 + `bot-v4.py` — Multi-Server Esports Manager

Multi-server esports tournament manager synced live with **SSE Tournament Bot (`bot-v4.py`)** and **SSE Accounts SSO**.

## What's New in v4.0
- **Week-Based Discord Forums:** Every matchmaking run (Week 1, Week 2, Week 3...) creates a dedicated Discord Forum Channel (`<tournament>-week-1`, `<tournament>-week-2`, ...) with:
  - 4 auto-managed Forum Tags: **`Pending`** (default), **`Submitted`**, **`Issue`**, and **`Results Declared`**.
  - A pinned, **locked** (`locked=True`, read-only) **`📣 Week X Announcements`** post inside every week forum.
  - Clean match posts (`Match 1 — Ram vs John`) with persistent interactive winner buttons and direct screenshot submission.
- **Named Result Submissions Everywhere:** Real player/team names appear in Discord match post buttons, `/match submit` autocomplete, and every web Approve / Forfeit / Override control—never generic `Side A` / `Side B`.
- **Reliable Announcements & Week Broadcasts:** Resolves announcement channels across tournament settings, Server Settings, and `/setup`, supports broadcasting week announcements into the locked Week post and every match post in that week, and reports live `Bot Sync` delivery status back on the website.
- **Close Week & Close Tournament Controls:** Lock or reopen any individual week's forum posts, or close an entire tournament (with or without declaring official podium winners) right from the web dashboard.
- **Strict Member Privacy & Conditional Teams Navbar:**
  - Normal members only see **Tournaments** at the server level, and inside a tournament only see **My Match & Info** (opponent name, live tag, direct Discord forum post link), **Standings & Results**, and (in team mode) **Teams & Rosters**.
  - **Teams & Rosters** appears in the sidebar **only when `mode === "team"`** (hidden even for Owners/Admins in solo tournaments).
  - Squad Power screenshots, match proofs of other players, and CSV exports are strictly protected for Owners & assigned Moderators.
- **Global Sync Loader:** Indeterminate top sweep bar + subtle floating `Syncing live data...` indicator across every API request and route change.
- **Fixed `/web` Command:** Replaced invalid `discord.Color.emerald()` calls with RGB emerald so `/web` and all bot embeds work cleanly.

## Deploy
1. Push `sse-tournament-web` (`sse-tournament-web-v4.zip`) to GitHub for Vercel deployment.
2. Rename `bot-v4.py` to `bot.py` in your bot repo, verify `WEB_DASHBOARD_URL` and `MONGODB_URI` in Render `.env`, and redeploy.
