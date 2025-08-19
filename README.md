# Souls Help Board

A lightweight board to publish and discover co‑op/help requests for Soulslike games.

Current stack
- Frontend: static (index.html, styles.css, app.js)
- Backend: Node/Express (server/) + Supabase (Postgres)
- Hosting example: Frontend on Vercel, Backend on Render

Key features
- Create/list/remove help requests with expiration (default 4h; up to 24h)
- Game filter; Elden Ring boss/location suggestions via Elden Ring Fan API
- Online/offline status badge and offline fallback (localStorage)
- Pagination (server-side): Previous/Next controls in UI
- Backend hardening: CORS (configurable), rate limiting, periodic purge of expired requests, request logging

---

## Project structure
- index.html, styles.css, app.js — static client
- server/ — Node/Express API that talks to Supabase and (optionally) serves static files for local/dev

---

## Environment variables (backend)
- SUPABASE_URL (required) — Supabase Project URL
- SUPABASE_SERVICE_ROLE_KEY (required) — Service Role Key (server-side only; do NOT expose in frontend)
- CORS_ORIGINS (optional) — comma-separated list of allowed origins (e.g. `https://your-frontend.vercel.app,https://souls-help.onrender.com`). If unset, CORS is open
- FRONTEND_URL (optional) — if set, any non-/api route on the backend will 302-redirect to this URL (useful to canonicalize to Vercel frontend)
- PORT (optional) — backend port (Render sets this automatically)

---

## Supabase schema (run in SQL Editor)
```sql
create table if not exists public.requests (
  id text primary key,
  createdAt bigint not null,
  expiresAt bigint not null,
  game text not null,
  type text not null,
  target text not null,
  platform text not null,
  level text,
  password text,
  region text,
  notes text
);

create index if not exists idx_requests_expires on public.requests (expiresAt);
create index if not exists idx_requests_game on public.requests (game);
```

Notes:
- Service Role Key bypasses RLS and must be kept server-side only.
- If later you want public read from the client, create RLS policies for SELECT carefully and consider omitting sensitive fields.

---

## API
- GET /api/health → `{ ok: true }` when DB connectivity is fine

- GET /api/requests
  - Query params: `game`, `page` (>=1), `pageSize` (1–100)
  - Response: `{ items: Request[], total: number, page: number, pageSize: number }`

- POST /api/requests
  - Body (JSON): `{ game, type, target, platform, level?, password?, region?, notes?, createdAt?, expiresAt? }`
  - Returns 201 with the created request

- DELETE /api/requests/:id → 204 on success

Request shape stored
```ts
{
  id: string,
  createdAt: number,     // epoch ms
  expiresAt: number,     // epoch ms
  game: 'elden-ring'|'ds1'|'ds2'|'ds3'|'bb',
  type: 'boss'|'area'|'coop'|'pvp'|'trade'|'other',
  target: string,
  platform: 'ps'|'xbox'|'pc',
  level?: string,
  password?: string,
  region?: string,
  notes?: string
}
```

---

## Running locally
Requirements: Node.js 18+

Option A (recommended)
```bash
cd server
npm install
# Set env vars before starting (PowerShell example):
# $env:SUPABASE_URL = "https://...supabase.co"
# $env:SUPABASE_SERVICE_ROLE_KEY = "..."
node server.js
```
Open http://localhost:3000. The backend will serve the static frontend from repository root in dev.

Option B (one‑click on Windows)
- Double‑click `start.bat` (installs deps, starts server and opens browser).

Without backend running
- The frontend will still work in a limited, offline mode using localStorage (no shared feed).

---

## Deploy (Render)
Web Service (Node) — choose ONE of the setups:

A) Root Directory = `server`
- Build Command: `npm install`
- Start Command: `node server.js`
- Health Check Path: `/api/health`
- Environment: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional CORS_ORIGINS, FRONTEND_URL

B) Root Directory = repo root
- Build Command: `npm install --prefix server`
- Start Command: `npm start --prefix server`
- Health Check Path: `/api/health`
- Environment: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional CORS_ORIGINS, FRONTEND_URL

Tips
- Use “Clear build cache & deploy” if dependencies change
- The backend logs with morgan; API errors show up in Render Logs

---

## Frontend hosting
- If hosted separately (e.g. Vercel), set in index.html:
```html
<script>window.__API_BASE__ = 'https://your-backend.onrender.com';</script>
```
- If you want to canonicalize to Vercel, set `FRONTEND_URL` on the backend. All non-/api requests to the Render service will 302 to your Vercel URL.

---

## Credits
- Elden Ring Fan API — https://eldenring.fanapis.com
- Not affiliated with FromSoftware/Bandai

---

## Roadmap (optional)
- Discord Webhook integration (post/cleanup on create/delete/expire)
- i18n toggle (EN/PT-BR)
- PWA (manifest + SW), SEO (canonical/OG), UI polish (toasts/loading)
