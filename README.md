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
- Banco é um JSON local (server/data/requests.json). Em produção, substitua por um banco real (Postgres/Supabase/Firebase etc.).
- CORS habilitado.

## Deploy
- Pode ser hospedado em qualquer serviço Node (Railway, Render, Fly.io, etc.).
- Ajuste variáveis de ambiente se necessário (PORT).
