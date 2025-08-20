# Souls Help Board

O que é
- Um quadro simples para publicar e encontrar pedidos de ajuda/coop em jogos Soulslike (ex.: Elden Ring, Dark Souls, Bloodborne).

Como funciona
- Crie um pedido informando jogo, tipo de ajuda (boss/área/coop/pvp/etc.), alvo e plataforma. Cada pedido tem um tempo de expiração automático.
- A página lista os pedidos mais recentes e permite filtrar por jogo.
- Online: os pedidos são compartilhados entre todos. Offline: o site funciona de forma limitada e salva localmente até poder sincronizar.

Tecnologia (simples)
- Frontend: página estática (HTML/CSS/JS)
- Backend: API leve em Node/Express
- Banco de dados: Supabase (Postgres)
- Offline: fallback com localStorage
