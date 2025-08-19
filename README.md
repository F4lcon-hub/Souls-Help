# Souls Help Board

Agora com backend opcional (Node/Express) para feed compartilhado.

## Estrutura
- index.html, styles.css, app.js: frontend estático
- server/: backend Node/Express que serve a API e os arquivos estáticos

## Rodando o backend localmente
1. Instale Node.js LTS (>=18)
2. Em um terminal, rode:
   - cd server
   - npm install
   - npm start
3. A API subirá em http://localhost:3000 e servirá o frontend estático na raiz do projeto.

## Como funciona
- O frontend tenta usar a API para listar/criar/remover pedidos.
- Se a API estiver indisponível (ex.: abrindo via file://), ele cai para o armazenamento local (localStorage).
- Sincronização periódica: a cada 15s busca atualizações do servidor.
- Expiração: pedidos expiram com TTL (padrão 4h).

## Endpoints
- GET /api/requests?game=elden-ring
- POST /api/requests (JSON corpo com {game,type,target,platform,level,password,region,notes,createdAt,expiresAt})
- DELETE /api/requests/:id

## Observações
- Banco é um JSON local (server/data/requests.json). Em produção, o filesystem de algumas plataformas é efêmero. Para persistir os dados sem migrar para banco, use um Disco Persistente.
- CORS habilitado.

## Deploy no Render com Disco Persistente (recomendado para JSON)
1. Faça deploy do serviço como Web Service apontando para o diretório `server/`.
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Health Check Path: `/api/health`
2. Em Settings → Disks, crie um Persistent Disk (ex.: 1–5 GB) e monte-o em `/data`.
3. Em Environment → Add Environment Variable, defina `DATA_DIR=/data`.
4. Em Scaling, limite para 1 instância (min=1, max=1) para evitar concorrência no arquivo JSON.
5. Redeploy. Nos logs você verá:
   - `Data directory: /data`
   - `DB file: /data/requests.json`

## Deploy em outras plataformas
- Fly.io: use Volumes montados em `/data` e defina `DATA_DIR=/data`.
- Cloud Run/Vercel/Netlify: o filesystem é efêmero; use banco externo (Supabase/Neon/Postgres) ou storage dedicado.

## Variáveis de ambiente
- `PORT`: porta do servidor (a plataforma define automaticamente; o app lê de `process.env.PORT`).
- `DATA_DIR`: diretório onde o JSON será salvo (ex.: `/data` em produção). Fallback: `server/data`.
