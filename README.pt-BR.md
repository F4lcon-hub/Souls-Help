# Souls Help Board (PT-BR)

Versão em inglês: consulte o arquivo `README.md`.

Um quadro leve para publicar e descobrir pedidos de coop/ajuda para jogos Soulslike.

Pilha atual
- Frontend: estático (index.html, styles.css, app.js)
- Backend: Node/Express (server/) + Supabase (Postgres)
- Hospedagem exemplo: Frontend no Vercel, Backend no Render

Principais recursos
- Criar/listar/remover pedidos de ajuda com expiração (padrão 4h; até 24h)
- Filtro por jogo; sugestões de chefe/local para Elden Ring via Elden Ring Fan API
- Selo de status online/offline e fallback offline (localStorage)
- Paginação (server-side): controles de Anterior/Próxima página na UI
- Reforços no backend: CORS (configurável), rate limiting, limpeza periódica de pedidos expirados, logging de requisições

---

## Estrutura do projeto
- index.html, styles.css, app.js — cliente estático
- server/ — API Node/Express que conversa com Supabase e (opcionalmente) serve arquivos estáticos no local/dev

---

## Variáveis de ambiente (backend)
- SUPABASE_URL (obrigatória) — URL do projeto Supabase
- SUPABASE_SERVICE_ROLE_KEY (obrigatória) — Service Role Key (somente no servidor; não exponha no frontend)
- CORS_ORIGINS (opcional) — lista separada por vírgulas de origens permitidas (ex.: `https://seu-frontend.vercel.app,https://souls-help.onrender.com`). Se não definido, CORS é aberto
- FRONTEND_URL (opcional) — se definido, qualquer rota não-/api no backend fará redirecionamento 302 para essa URL (útil para canonizar para o frontend no Vercel)
- PORT (opcional) — porta do backend (no Render é configurada automaticamente)

---

## Esquema Supabase (rodar no SQL Editor)
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

Notas:
- Service Role Key ignora RLS e deve ficar somente no servidor.
- Se futuramente quiser leitura pública pelo cliente, crie políticas RLS para SELECT com cuidado e considere omitir campos sensíveis.

---

## API
- GET /api/health → `{ ok: true }` quando a conectividade com o banco estiver ok

- GET /api/requests
  - Query params: `game`, `page` (>=1), `pageSize` (1–100)
  - Resposta: `{ items: Request[], total: number, page: number, pageSize: number }`

- POST /api/requests
  - Body (JSON): `{ game, type, target, platform, level?, password?, region?, notes?, createdAt?, expiresAt? }`
  - Retorna 201 com o pedido criado

- DELETE /api/requests/:id → 204 em sucesso

Formato armazenado do pedido
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

## Rodando localmente
Requisitos: Node.js 18+

Opção A (recomendada)
```bash
cd server
npm install
# Defina as variáveis antes de iniciar (exemplo PowerShell):
# $env:SUPABASE_URL = "https://...supabase.co"
# $env:SUPABASE_SERVICE_ROLE_KEY = "..."
node server.js
```
Abra http://localhost:3000. O backend servirá o frontend estático a partir da raiz do repositório em dev.

Opção B (um clique no Windows)
- Dê duplo clique em `start.bat` (instala dependências, inicia o servidor e abre o navegador).

Sem backend em execução
- O frontend funcionará em modo offline (localStorage), de forma limitada (sem feed compartilhado).

---

## Deploy (Render)
Serviço Web (Node) — escolha UMA das configurações:

A) Root Directory = `server`
- Build Command: `npm install`
- Start Command: `node server.js`
- Health Check Path: `/api/health`
- Environment: defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, e opcionais CORS_ORIGINS, FRONTEND_URL

B) Root Directory = raiz do repositório
- Build Command: `npm install --prefix server`
- Start Command: `npm start --prefix server`
- Health Check Path: `/api/health`
- Environment: defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, e opcionais CORS_ORIGINS, FRONTEND_URL

Dicas
- Use “Clear build cache & deploy” se as dependências mudarem
- O backend loga com morgan; erros da API aparecem nos Logs do Render

---

## Hospedagem do frontend
- Se hospedado separadamente (ex.: Vercel), defina em index.html:
```html
<script>window.__API_BASE__ = 'https://seu-backend.onrender.com';</script>
```
- Se quiser canonizar para o Vercel, defina `FRONTEND_URL` no backend. Todas as requisições não-/api no serviço do Render redirecionarão (302) para sua URL do Vercel.

---

## Créditos
- Elden Ring Fan API — https://eldenring.fanapis.com
- Não afiliado à FromSoftware/Bandai

---

## Roteiro (opcional)
- Integração com Discord Webhook (post/cleanup ao criar/deletar/expirar)
- Alternância de idioma (EN/PT-BR)
- PWA (manifest + SW), SEO (canônico/OG), polimento de UI (toasts/loading)

---

## Favicons & Manifest PWA
Os favicons ficam em `favicons/` e são referenciados a partir de `index.html` com cache-busting para evitar ícones desatualizados.

Arquivos em `favicons/`:
- android-chrome-192x192.png
- android-chrome-512x512.png
- apple-touch-icon.png
- favicon-16x16.png
- favicon-32x32.png
- favicon.ico
- site.webmanifest

Trechos no `index.html` (caminhos relativos à raiz do projeto):
- apple-touch-icon → `favicons/apple-touch-icon.png?v=2`
- 32x32 → `favicons/favicon-32x32.png?v=2`
- 16x16 → `favicons/favicon-16x16.png?v=2`
- 192x192/512x512 → `favicons/android-chrome-*.png?v=2`
- favicon.ico → `favicons/favicon.ico?v=2` (também inclui `rel="shortcut icon"`)
- manifest → `favicons/site.webmanifest?v=2`

Notas do manifest:
- `favicons/site.webmanifest` referencia ícones usando caminhos absolutos `/favicons/...` para deploys na raiz.
- Se for publicar sob um subcaminho (ex.: `https://dominio.com/app`), prefira `src` relativos no manifest (ex.: `android-chrome-192x192.png`) ou ajuste os caminhos.

Solução de problemas (favicons):
- Sirva via HTTP (ex.: `http://localhost:5500`) em vez de abrir com `file://`, pois alguns navegadores ignoram favicon/manifest em `file://`.
- Dê hard reload (Ctrl+F5) e/ou limpe dados do site (DevTools → Application → Clear storage).
- Verifique em DevTools → Network se `favicon*` retorna 200.
- Alguns navegadores ainda procuram `/favicon.ico` na raiz. Se necessário, coloque uma cópia na raiz com nome `favicon.ico`.

---

## Ajuste de quebra de texto na UI
Para evitar linhas com uma única palavra e quebras agressivas, as regras de quebra de texto foram ajustadas em `styles.css`:
- `.request-content` e `.request-notes`: `overflow-wrap: break-word; word-break: normal; hyphens: auto;` (com `-webkit-hyphens` para compatibilidade)

---

## Texto do rodapé
Texto do rodapé atualizado para:
- "Projeto sem fins lucrativos. Feito por um fã da série para outros fãs, site ainda em manutenção, pode ficar offline às vezes."

---

## Hierarquia de arquivos por importância

1) Críticos para a execução do app (Frontend)
- `app.js` — Lógica principal da aplicação (renderização, sincronização, fallback offline, status/retry).
- `index.html` — Estrutura da página; injeta `__API_BASE__`, carrega `app.js` e `styles.css`, contém modais.
- `styles.css` — Estilos base usados em todo o frontend.

2) Críticos para o modo online (Backend)
- `server/server.js` — API (Node/Express) que integra com Supabase.
- `server/package.json` — Dependências e scripts do backend.

3) Auxiliares de UX/Assets e conveniência
- `favicons/` (e `site.webmanifest`) — Ícones e manifest PWA.
- `start.bat` — Script de conveniência no Windows (instala e inicia o backend e abre o navegador).
- `styles-mobile.css`, `styles-desktop.css` — Estilos opcionais/alternativos. Observação: atualmente o `index.html` referencia `styles.css`.

4) Documentação e tooling
- `README.pt-BR.md` — Este arquivo (documentação completa em português).
- `README.md` — Documentação em inglês.
- `.vscode/`, `.qodo/`, `.git/` — Pastas de tooling/controle de versão (não impactam a execução em produção).

Notas rápidas
- Para o frontend funcionar: `index.html` + `styles.css` + `app.js` são indispensáveis.
- Para funcionalidades online (feed compartilhado): é necessário o backend (`server/` + variáveis `SUPABASE_*`).
- Sem backend: o app opera em modo offline (`localStorage`), com sincronização assim que o backend voltar (retry automático).
