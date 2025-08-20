# Souls Help Board

What it is
- A simple board to post and find co-op/help requests for Soulslike games (e.g., Elden Ring, Dark Souls, Bloodborne).

How it works
- Create a request with the game, help type (boss/area/coop/pvp/etc.), target, and platform. Each request has a time limit and expires automatically.
- The page lists recent requests and lets you filter by game.
- When online, requests are shared for everyone. If offline, the site still works in a limited mode and saves locally until it can sync.

Tech (simple)
- Frontend: static page (HTML/CSS/JS)
- Backend: small Node/Express API
- Database: Supabase (Postgres)
- Offline: localStorage fallback
