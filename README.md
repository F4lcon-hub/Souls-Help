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

---

## Favicons & PWA manifest
Favicons are organized under `favicons/` and referenced from `index.html` with cache-busting to avoid stale icons.

Files under `favicons/`:
- android-chrome-192x192.png
- android-chrome-512x512.png
- apple-touch-icon.png
- favicon-16x16.png
- favicon-32x32.png
- favicon.ico
- site.webmanifest

Head snippet in `index.html` (paths relative to project root):
- apple-touch-icon → `favicons/apple-touch-icon.png?v=2`
- 32x32 → `favicons/favicon-32x32.png?v=2`
- 16x16 → `favicons/favicon-16x16.png?v=2`
- 192x192/512x512 → `favicons/android-chrome-*.png?v=2`
- favicon.ico → `favicons/favicon.ico?v=2` (also includes `rel="shortcut icon"`)
- manifest → `favicons/site.webmanifest?v=2`

Manifest notes:
- `favicons/site.webmanifest` references icons using absolute paths `/favicons/...` for root deployments.
- If deploying under a subpath (e.g., `https://domain.com/app`), prefer relative `src` in the manifest (e.g., `android-chrome-192x192.png`) or adjust paths accordingly.

Troubleshooting favicons:
- Serve over HTTP (e.g., `http://localhost:5500`) instead of opening `file://`, as some browsers skip favicon/manifest on `file://`.
- Hard reload (Ctrl+F5) and/or clear site data (DevTools → Application → Clear storage).
- Check DevTools → Network for `favicon*` and ensure 200 responses.
- Some browsers still probe `/favicon.ico` at the root. If needed, place a copy at the repository root named `favicon.ico`.

## UI text wrapping update
To avoid awkward single-word lines and overly aggressive breaks, text wrapping rules were adjusted in `styles.css`:
- `.request-content` and `.request-notes`: `overflow-wrap: break-word; word-break: normal; hyphens: auto;` (with `-webkit-hyphens` for compatibility)

## Footer copy
Footer text updated to:
- "Non-profit project. Made by a fan of the series to other fans, site still under management, can be offline sometimes."

---

## Hierarquia de arquivos por importância (PT-BR)

1) Críticos para a execução do app (Frontend)
- app.js — Lógica principal da aplicação (renderização, sincronização, fallback offline, status/retry).
- index.html — Estrutura da página; injeta __API_BASE__, carrega app.js e styles.css, contém modais.
- styles.css — Estilos base usados em todo o frontend.

2) Críticos para o modo online (Backend)
- server/server.js — API (Node/Express) que integra com Supabase.
- server/package.json — Dependências e scripts do backend.

3) Auxiliares de UX/Assets e conveniência
- favicons/ (e site.webmanifest) — Ícones e manifest PWA.
- start.bat — Script de conveniência no Windows (instala e inicia o backend e abre o navegador).
- styles-mobile.css, styles-desktop.css — Estilos opcionais/alternativos. Observação: atualmente o index.html referencia styles.css.

4) Documentação e tooling
- README.md — Documentação do projeto (setup, API, deploy, estrutura).
- .vscode/, .qodo/, .git/ — Pastas de tooling/controle de versão (não impactam a execução em produção).

Notas rápidas
- Para o frontend funcionar: index.html + styles.css + app.js são indispensáveis.
- Para funcionalidades online (feed compartilhado): é necessário o backend (server/ + variáveis SUPABASE_*).
- Sem backend: o app opera em modo offline (localStorage), com sincronização assim que o backend voltar (retry automático).

---

## File hierarchy by importance (EN-US)

1) Critical for app runtime (Frontend)
- app.js — Core app logic (rendering, sync, offline fallback, status/retry).
- index.html — Page skeleton; injects __API_BASE__, loads app.js and styles.css, hosts modals.
- styles.css — Base styles used across the frontend.

2) Critical for online mode (Backend)
- server/server.js — API (Node/Express) integrating with Supabase.
- server/package.json — Backend dependencies and scripts.

3) UX/assets and convenience
- favicons/ (and site.webmanifest) — Icons and PWA manifest.
- start.bat — Windows convenience script (installs/starts backend and opens browser).
- styles-mobile.css, styles-desktop.css — Optional/alternative styles. Note: index.html currently references styles.css.

4) Documentation and tooling
- README.md — Project documentation (setup, API, deploy, structure).
- .vscode/, .qodo/, .git/ — Tooling/version control folders (no impact on production runtime).

Quick notes
- To run the frontend: index.html + styles.css + app.js are essential.
- For online features (shared feed): backend (server/ + SUPABASE_* envs) is required.
- Without backend: the app runs in offline mode (localStorage), syncing once backend is back (automatic retry).
