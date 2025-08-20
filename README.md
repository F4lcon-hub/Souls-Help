# Souls Help Board

Simple board to share and find co‑op/help requests for Soulslike games.

Purpose
- Let players post requests (boss, area, co‑op, PvP, trade) and find others to help.

What’s inside
- Frontend (static): index.html, styles.css, app.js, ui.js, shared.js, favicons/
  - Works offline (localStorage) and shows an online/offline badge.
  - Elden Ring boss/location suggestions from Elden Ring Fan API.
  - Pagination, filters, copy/share/remove actions.
- Backend (Node/Express, server/): stores requests in Supabase (Postgres) and exposes a simple API.

Quick start (local)
Option 1 — with backend (recommended)
1. cd server
2. npm install
3. Set env vars before starting:
   - SUPABASE_URL = https://YOUR_PROJECT.supabase.co
   - SUPABASE_SERVICE_ROLE_KEY = YOUR_SERVICE_ROLE_KEY
   - (optional) CORS_ORIGINS = https://your-frontend.example.com
   - (optional) FRONTEND_URL = https://your-frontend.example.com
4. node server.js
5. Open http://localhost:3000 (the backend serves the static frontend from repo root in dev).

Option 2 — frontend only (offline mode)
- Open index.html directly in your browser. You can create, list and remove requests locally (not shared).
- If you have a hosted backend, set in index.html:
  <script>window.__API_BASE__ = 'https://your-backend.example.com';</script>

API (server)
- GET /api/health → { ok: true }
- GET /api/requests?game=&page=&pageSize=
- POST /api/requests
  - Body: { game, type, target, platform, level?, password?, region?, notes?, createdAt?, expiresAt? }
- DELETE /api/requests/:id

Tech used
- Frontend: HTML, CSS, Vanilla JS
- Backend: Node.js + Express
- Database: Supabase (Postgres)
- Community data: Elden Ring Fan API (suggestions)

Deploy (short)
- Backend: deploy server/ to any Node host (e.g., Render). Configure env vars.
- Frontend: host static files (index.html, styles.css, app.js, ui.js, shared.js, favicons/) on Vercel/GitHub Pages/etc. Set window.__API_BASE__ to your backend URL.

---

# Souls Help Board (PT‑BR)

Quadro simples para publicar e encontrar pedidos de coop/ajuda para jogos Soulslike.

Propósito
- Permitir que jogadores publiquem pedidos (chefe, área, co‑op, PvP, troca) e encontrem ajuda.

O que contém
- Frontend (estático): index.html, styles.css, app.js, ui.js, shared.js, favicons/
  - Funciona offline (localStorage) e exibe um selo online/offline.
  - Sugestões de chefe/local de Elden Ring via Elden Ring Fan API.
  - Paginação, filtros e ações de copiar/compartilhar/remover.
- Backend (Node/Express, server/): armazena pedidos no Supabase (Postgres) e expõe uma API simples.

Como rodar (local)
Opção 1 — com backend (recomendada)
1. cd server
2. npm install
3. Defina as variáveis de ambiente antes de iniciar:
   - SUPABASE_URL = https://SEU_PROJETO.supabase.co
   - SUPABASE_SERVICE_ROLE_KEY = SUA_SERVICE_ROLE_KEY
   - (opcional) CORS_ORIGINS = https://seu-frontend.exemplo.com
   - (opcional) FRONTEND_URL = https://seu-frontend.exemplo.com
4. node server.js
5. Abra http://localhost:3000 (o backend serve o frontend estático a partir da raiz do repositório em dev).

Opção 2 — apenas frontend (modo offline)
- Abra index.html diretamente no navegador. Você pode criar/listar/remover pedidos localmente (não compartilhado).
- Se tiver um backend hospedado, defina em index.html:
  <script>window.__API_BASE__ = 'https://seu-backend.exemplo.com';</script>

API (servidor)
- GET /api/health → { ok: true }
- GET /api/requests?game=&page=&pageSize=
- POST /api/requests
  - Body: { game, type, target, platform, level?, password?, region?, notes?, createdAt?, expiresAt? }
- DELETE /api/requests/:id

Tecnologias
- Frontend: HTML, CSS, JavaScript puro
- Backend: Node.js + Express
- Banco: Supabase (Postgres)
- Dados da comunidade: Elden Ring Fan API (sugestões)

Deploy (resumo)
- Backend: faça deploy de server/ em um host Node (ex.: Render). Configure as variáveis de ambiente.
- Frontend: hospede os arquivos estáticos (index.html, styles.css, app.js, ui.js, shared.js, favicons/) em Vercel/GitHub Pages/etc. Defina window.__API_BASE__ com a URL do backend.
