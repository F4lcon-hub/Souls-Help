(function(){
  'use strict';

  /*
    Souls Help Frontend (UI)

    PT-BR (resumo):
    - Interface para publicar e listar pedidos de ajuda em jogos Soulslike.
    - Sincroniza com um backend (API/Supabase). Se estiver offline, usa localStorage como fallback.
    - Inclui paginação, filtro por jogo, sugestões de chefe/local para Elden Ring, compartilhamento e cópia de detalhes.
    - Indicador de status online/offline e rotina de retry automática quando o backend estiver indisponível.

    EN-US (summary):
    - UI to publish and list help requests for Soulslike games.
    - Syncs with a backend (API/Supabase). Falls back to localStorage when offline.
    - Includes pagination, game filter, Elden Ring boss/location suggestions, share and copy actions.
    - Online/offline status indicator and automatic retry routine when backend is down.
  */

  // =====================
  // Config
  // =====================
  // PT-BR: Chaves/constantes de configuração geral.
  // EN: General configuration keys/constants.
  const STORAGE_KEY = 'souls_help_requests_v1';
  const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // PT-BR/EN: 4h (expiração padrão)

  // PT-BR: Base do backend. Se servido via HTTP, usa relativo; se aberto via file://, aponta para localhost.
  // EN: Backend base. If served via HTTP, use relative; for file:// open, default to localhost.
  const API_BASE = (typeof window !== 'undefined' && typeof window.__API_BASE__ === 'string' && window.__API_BASE__)
    ? window.__API_BASE__
    : (location.origin.startsWith('http') ? '' : 'http://localhost:3000');

  const POLL_MS = 15000; // PT-BR/EN: intervalo do polling de sincronização (ms)
  const HEALTH_URL = `${API_BASE}/api/health`; // PT-BR/EN: endpoint de saúde do backend

  // PT-BR: Configuração opcional do Supabase Realtime (via variáveis globais injetadas).
  // EN: Optional Supabase Realtime configuration (via injected globals).
  const SUPABASE_URL = window.__SUPABASE_URL__ || '';
  const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || '';
  let supabaseClient = null;
  let realtimeSubscribed = false;
  let realtimeDebounce = null;

  // =====================
  // Elementos (DOM)
  // =====================
  // PT-BR: Referências aos elementos da interface.
  // EN: References to UI DOM elements.
  const form = document.getElementById('help-form');
  const requestsEl = document.getElementById('requests');
  const emptyEl = document.getElementById('empty-state');
  const filterGame = document.getElementById('filter-game');
  const clearExpiredBtn = document.getElementById('clear-expired');

  const gameSelect = document.getElementById('game');
  const reqType = document.getElementById('req-type');
  const targetInput = document.getElementById('target');
  const targetList = document.getElementById('target-suggestions');
  const platform = document.getElementById('platform');
  const levelInput = document.getElementById('level');
  const passwordInput = document.getElementById('password');
  const regionSelect = document.getElementById('region');
  const notesInput = document.getElementById('notes');
  const expire4h = document.getElementById('expire4h');

  // =====================
  // Paginação (UI dinâmica)
  // =====================
  // PT-BR: Construímos a UI de paginação via JS e inserimos após o empty-state.
  // EN: Build pagination UI via JS and insert it after empty-state.
  const pagination = document.createElement('div');
  pagination.id = 'pagination';
  pagination.className = 'actions';
  const pagePrev = document.createElement('button'); pagePrev.id = 'page-prev'; pagePrev.className = 'ghost'; pagePrev.type = 'button'; pagePrev.textContent = 'Previous';
  const pageInfo = document.createElement('span'); pageInfo.id = 'page-info'; pageInfo.className = 'page-info';
  const pageNext = document.createElement('button'); pageNext.id = 'page-next'; pageNext.className = 'ghost'; pageNext.type = 'button'; pageNext.textContent = 'Next';
  pagination.appendChild(pagePrev); pagination.appendChild(pageInfo); pagination.appendChild(pageNext);
  if (emptyEl && emptyEl.parentNode){ emptyEl.parentNode.appendChild(pagination); }

  // =====================
  // Estado (State)
  // =====================
  // PT-BR: items é o cache local (offline). gameFilter é o filtro por jogo.
  // EN: items is the local (offline) cache. gameFilter filters by game.
  let items = load(); // local cache (used for offline fallback)
  let gameFilter = '';
  let currentPage = 1;
  let pageSize = 12; // PT-BR/EN: tamanho padrão de página
  let total = 0;
  let pageCount = 1;

  // =====================
  // Utilitários (Utils)
  // =====================
  const now = () => Date.now(); // PT-BR/EN: timestamp atual
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36); // PT-BR/EN: id simples

  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }

  function escapeHtml(s){
    // PT-BR: Sanitiza texto para evitar quebra de HTML.
    // EN: Sanitize text to avoid breaking HTML.
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtRemaining(ms){
    // PT-BR: Formata tempo restante (ms) em string amigável.
    // EN: Format remaining time (ms) into a friendly string.
    if (ms <= 0) return 'expired';
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const ss = s%60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${ss}s`;
  }

  function pruneExpiredLocal(){
    // PT-BR: Remove do cache local os itens expirados.
    // EN: Remove expired items from local cache.
    const t = now();
    items = items.filter(x => (x.expiresAt ?? 0) > t);
  }

  function updatePaginationUI(){
    // PT-BR: Atualiza botões/infos da paginação com base no total.
    // EN: Update pagination buttons/info based on totals.
    const shouldShow = total > pageSize;
    pagination.style.display = shouldShow ? 'flex' : 'none';
    pageCount = Math.max(1, Math.ceil(total / pageSize));
    pagePrev.disabled = currentPage <= 1;
    pageNext.disabled = currentPage >= pageCount;
    pageInfo.textContent = `Page ${currentPage} of ${pageCount}`;
  }

  // =====================
  // Renderização (Render)
  // =====================
  function render(){
    // PT-BR: Renderiza a lista atual (fatiada) e estado vazio.
    // EN: Render current (sliced) list and empty state.
    const list = items.slice();
    requestsEl.innerHTML = list.map(renderItem).join('');
    emptyEl.style.display = list.length ? 'none' : 'block';
    updatePaginationUI();
  }

  function renderItem(x){
    // PT-BR: Template de um card de pedido.
    // EN: Card template for a request.
    const left = (x.expiresAt ?? 0) - now();
    const notes = x.notes ? `<div class="request-notes">${escapeHtml(x.notes)}</div>` : '';
    return `
      <article class="request" data-id="${x.id}">
        <div class="request-top">
          <div class="badges">
            <span class="badge game">${labelGame(x.game)}</span>
            <span class="badge type">${labelType(x.type)}</span>
            <span class="badge platform">${labelPlatform(x.platform)}</span>
          </div>
          <div class="request-meta">
            <span class="countdown" title="Expires in">${fmtRemaining(left)}</span>
          </div>
        </div>
        <div class="request-content">
          <strong>Target:</strong> ${escapeHtml(x.target)}
          ${x.level ? ` • <strong>Level:</strong> ${escapeHtml(x.level)}` : ''}
          ${x.region ? ` • <strong>Region:</strong> ${escapeHtml(x.region)}` : ''}
          ${x.password ? ` • <strong>Password:</strong> ${escapeHtml(x.password)}` : ''}
        </div>
        ${notes}
        <div class="request-actions">
          <button class="btn" data-action="copy">Copy details</button>
          <button class="btn" data-action="share">Share</button>
          <button class="btn" data-action="remove">Remove</button>
        </div>
      </article>
    `;
  }

  function labelGame(code){
    // PT-BR: Converte códigos de jogo em rótulos amigáveis.
    // EN: Convert game codes to human-readable labels.
    const map = {
      'elden-ring':'Elden Ring', 'ds1':'Dark Souls Remastered', 'ds2':'Dark Souls II', 'ds3':'Dark Souls III',
      'bb':'Bloodborne'
    };
    return map[code] || code;
  }
  function labelType(code){
    // PT-BR/EN: Converte tipo (código -> rótulo)
    const map = { boss:'Defeat boss', area:'Explore area', coop:'Co-op PvE', pvp:'PvP', trade:'Trade', other:'Other' };
    return map[code] || code;
  }
  function labelPlatform(code){
    // PT-BR/EN: Converte plataforma (código -> rótulo)
    const map = { ps:'PlayStation', xbox:'Xbox', pc:'PC' };
    return map[code] || code;
  }

  // =====================
  // API helpers (com fallback offline)
  // =====================
  /**
   * PT-BR: Verifica se o backend está saudável.
   * EN: Check whether backend health endpoint is OK.
   * @returns {Promise<boolean>}
   */
  async function apiHealth(){
    const r = await fetch(HEALTH_URL, { cache: 'no-store' }).catch(()=>null);
    return !!(r && r.ok);
  }

  /**
   * PT-BR: Lista pedidos pela API (com paginação). Lança erro se falhar.
   * EN: List requests from API (paginated). Throws on failure.
   * @param {string} game - PT-BR: filtro por jogo | EN: game filter
   * @param {number} page - PT-BR/EN: página
   * @param {number} size - PT-BR/EN: tamanho da página
   * @returns {Promise<any>} PT-BR: resposta do servidor | EN: server response
   */
  async function apiList(game, page, size){
    const params = new URLSearchParams();
    if (game) params.set('game', game);
    if (page) params.set('page', String(page));
    if (size) params.set('pageSize', String(size));
    const url = `${API_BASE}/api/requests${params.toString() ? `?${params.toString()}` : ''}`;
    const r = await fetch(url).catch(() => null);
    if (!r || !r.ok) throw new Error('list_failed');
    return r.json();
  }

  /**
   * PT-BR: Cria um pedido via API. Lança erro se falhar.
   * EN: Create a request via API. Throws on failure.
   * @param {object} entry
   * @returns {Promise<any>}
   */
  async function apiCreate(entry){
    const r = await fetch(`${API_BASE}/api/requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
    }).catch(() => null);
    if (!r || !r.ok) throw new Error('create_failed');
    return r.json();
  }

  /**
   * PT-BR: Remove um pedido via API. Lança erro se falhar.
   * EN: Delete a request via API. Throws on failure.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function apiDelete(id){
    const r = await fetch(`${API_BASE}/api/requests/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    if (!r || (r.status !== 204 && r.status !== 404)) throw new Error('delete_failed');
  }

  function sliceLocalForPage(){
    // PT-BR: Monta lista local filtrada/ordenada e fatiada para a página atual.
    // EN: Build local filtered/sorted list and slice for the current page.
    pruneExpiredLocal();
    const full = (items || []).filter(x => !gameFilter || x.game === gameFilter).sort((a,b) => a.expiresAt - b.expiresAt);
    total = full.length;
    pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > pageCount) currentPage = pageCount;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    items = full.slice(start, end);
  }

  async function syncFromServer(){
    // PT-BR: Sincroniza do servidor. Em caso de erro, usa dados locais (offline).
    // EN: Sync from server. On error, fallback to local data (offline mode).
    try {
      const res = await apiList(gameFilter, currentPage, pageSize);
      if (Array.isArray(res)){
        // PT-BR: Compatibilidade com resposta não paginada (antiga)
        // EN: Back-compat for non-paginated response
        items = res;
        total = res.length;
        sliceLocalForPage();
      } else if (res && typeof res === 'object'){
        const { items: arr, total: t, page, pageSize: sz } = res;
        items = Array.isArray(arr) ? arr : [];
        total = Number.isFinite(t) ? t : items.length;
        currentPage = Number.isFinite(page) ? page : 1;
        pageSize = Number.isFinite(sz) ? sz : pageSize;
      }
      save();
    } catch (e) {
      // PT-BR: Offline: trabalha com os dados locais.
      // EN: Offline mode: work with local data.
      sliceLocalForPage();
    }
  }

  // =====================
  // Eventos (Form, Lista, Filtro, Paginação)
  // =====================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!gameSelect.value || !reqType.value || !targetInput.value) return;

    const ttl = expire4h.checked ? DEFAULT_TTL_MS : 24*60*60*1000; // PT-BR/EN: 24h se desmarcado

    const baseEntry = {
      createdAt: now(),
      expiresAt: now() + ttl,
      game: gameSelect.value,
      type: reqType.value,
      target: targetInput.value.trim(),
      platform: platform.value,
      level: levelInput.value || '',
      password: passwordInput.value || '',
      region: regionSelect.value || '',
      notes: notesInput.value.trim(),
    };

    try {
      const created = await apiCreate(baseEntry);
      // PT-BR: Após criar no servidor, sincroniza e renderiza.
      // EN: After creating on server, sync and render.
      await syncFromServer();
      render();
    } catch {
      // PT-BR: Fallback offline: cria localmente, salva e renderiza.
      // EN: Offline fallback: create locally, save and render.
      const offline = { id: uid(), ...baseEntry };
      items.unshift(offline);
      save();
      sliceLocalForPage();
      render();
    }

    // PT-BR: Limpa o formulário, mas mantém o jogo selecionado.
    // EN: Reset form while keeping selected game.
    form.reset();
    gameSelect.value = baseEntry.game;
  });

  requestsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const card = btn.closest('article.request');
    if (!card) return;
    const id = card.getAttribute('data-id');
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;

    const action = btn.dataset.action;
    if (action === 'remove'){
      // PT-BR: Tenta remover no servidor; em qualquer caso atualiza lista local e re-renderiza.
      // EN: Try to delete on server; either way update local list and re-render.
      try { await apiDelete(id); } catch {}
      items.splice(idx,1); save();
      await syncFromServer();
      render();
    } else if (action === 'copy'){
      // PT-BR: Copia os detalhes para a área de transferência.
      // EN: Copy details to clipboard.
      const x = items[idx];
      const text = `Help request (${labelGame(x.game)} - ${labelType(x.type)})\nTarget: ${x.target}\nPlatform: ${labelPlatform(x.platform)}\n${x.level?`Level: ${x.level}\n`:''}${x.region?`Region: ${x.region}\n`:''}${x.password?`Password: ${x.password}\n`:''}${x.notes?`Notes: ${x.notes}\n`:''}`;
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied!'; setTimeout(()=>btn.textContent='Copy details', 1500);} catch {}
    } else if (action === 'share'){
      // PT-BR: Gera link com payload de importação e usa Web Share API (se disponível).
      // EN: Generate link with import payload and use Web Share API (if available).
      const x = items[idx];
      const text = `Help in ${labelGame(x.game)} for ${labelType(x.type)} - Target: ${x.target}`;
      const payload = btoa(encodeURIComponent(JSON.stringify(x)));
      const link = `${location.origin}${location.pathname}?import=${payload}`;
      try {
        if (navigator.share){ await navigator.share({ title:'Souls Help', text, url: link }); }
        else { await navigator.clipboard.writeText(link); btn.textContent = 'Link copied!'; setTimeout(()=>btn.textContent='Share', 1500);} 
      } catch {}
    }
  });

  filterGame.addEventListener('change', async () => {
    // PT-BR: Muda filtro de jogo e sincroniza página 1.
    // EN: Change game filter and sync page 1.
    gameFilter = filterGame.value;
    currentPage = 1;
    await syncFromServer();
    render();
  });

  pagePrev.addEventListener('click', async () => {
    if (currentPage > 1){ currentPage--; await syncFromServer(); render(); }
  });
  pageNext.addEventListener('click', async () => {
    if (currentPage < pageCount){ currentPage++; await syncFromServer(); render(); }
  });

  clearExpiredBtn.addEventListener('click', () => {
    // PT-BR: Limpa itens expirados do cache local.
    // EN: Clear expired items from local cache.
    pruneExpiredLocal();
    sliceLocalForPage();
    render();
  });

  // =====================
  // Atualização de contagem regressiva (UX)
  // =====================
  setInterval(() => {
    // PT-BR: Atualiza os timers de cada card a cada segundo.
    // EN: Update each card timer every second.
    const nodes = document.querySelectorAll('.request');
    nodes.forEach(n => {
      const id = n.getAttribute('data-id');
      const it = items.find(x => x.id === id);
      if (!it) return;
      const left = (it.expiresAt ?? 0) - now();
      const el = n.querySelector('.countdown');
      if (el) el.textContent = fmtRemaining(left);
    });
  }, 1000);

  // =====================
  // Sugestões (Elden Ring Fan API)
  // =====================
  /**
   * PT-BR: Busca nomes (chefes/locais) para autocompletar quando jogo = Elden Ring.
   * EN: Fetch names (bosses/locations) to autocomplete when game = Elden Ring.
   * @param {string} term
   * @returns {Promise<string[]>}
   */
  async function fetchSuggestions(term){
    const q = term.trim().toLowerCase();
    if (!q || gameSelect.value !== 'elden-ring') return [];
    const endpointBosses = `https://eldenring.fanapis.com/api/bosses?name=${encodeURIComponent(q)}`;
    const endpointLoc = `https://eldenring.fanapis.com/api/locations?name=${encodeURIComponent(q)}`;

    try {
      const [rb, rl] = await Promise.all([
        fetch(endpointBosses).then(r=>r.json()).catch(()=>({data:[]})),
        fetch(endpointLoc).then(r=>r.json()).catch(()=>({data:[]})),
      ]);
      const names = new Set();
      for (const b of rb.data||[]) names.add(b.name);
      for (const l of rl.data||[]) names.add(l.name);
      return [...names].slice(0, 10);
    } catch { return []; }
  }

  let suggestTimer = null;
  targetInput.addEventListener('input', () => {
    // PT-BR: Debounce simples para não fazer requisições a cada tecla.
    // EN: Simple debounce to avoid a request per keystroke.
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(async () => {
      const term = targetInput.value;
      const list = await fetchSuggestions(term);
      targetList.innerHTML = list.map(n => `<option value="${n}"></option>`).join('');
    }, 250);
  });

  // =====================
  // Importação via URL (?import=...)
  // =====================
  (function(){
    // PT-BR: Permite importar um pedido via parâmetro de URL e adicioná-lo localmente.
    // EN: Allow importing a request via URL parameter and add it locally.
    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get('import');
      if (raw){
        const entry = JSON.parse(decodeURIComponent(atob(raw)));
        if (entry && typeof entry === 'object'){
          const allowedGames = ['elden-ring','ds1','ds2','ds3','bb'];
          if (entry.game && allowedGames.includes(entry.game) && entry.type && entry.target && entry.platform){
            entry.id = uid();
            entry.createdAt = entry.createdAt || now();
            entry.expiresAt = entry.expiresAt && entry.expiresAt > now() ? entry.expiresAt : now() + DEFAULT_TTL_MS;
            entry.level = entry.level || '';
            entry.password = entry.password || '';
            entry.region = entry.region || '';
            entry.notes = entry.notes || '';
            items.unshift(entry); save();
          }
        }
        if (location && location.pathname){
          history.replaceState(null, '', location.pathname);
        }
      }
    } catch {}
  })();

  // =====================
  // Realtime via Supabase (opcional)
  // =====================
  /**
   * PT-BR: Inicializa canal realtime do Supabase (se chaves válidas existirem). Retorna true/false.
   * EN: Initialize Supabase realtime channel (if valid keys exist). Returns true/false.
   */
  async function initRealtime(){
    try {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
      // PT-BR: Carrega supabase-js via CDN se não estiver presente.
      // EN: Load supabase-js from CDN if not present.
      if (!(window.Supabase && window.Supabase.createClient) && !(window.supabase && window.supabase.createClient)){
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          s.async = true; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
        });
      }
      const createClient = (window.Supabase && window.Supabase.createClient) || (window.supabase && window.supabase.createClient);
      if (!createClient) return false;
      supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      supabaseClient
        .channel('public:requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
          // PT-BR: Debounce: várias mudanças em sequência viram uma sincronização.
          // EN: Debounce: multiple rapid changes collapse into one sync.
          clearTimeout(realtimeDebounce);
          realtimeDebounce = setTimeout(async () => { await syncFromServer(); render(); }, 200);
        })
        .subscribe();
      realtimeSubscribed = true;
      return true;
    } catch { return false; }
  }

  // =====================
  // Indicador de status (online/offline)
  // =====================
  /**
   * PT-BR: Atualiza o rótulo/estilo do indicador de status com base na saúde do backend.
   * EN: Update status indicator label/style based on backend health.
   */
  async function updateStatus(){
    const el = document.getElementById('api-status');
    if (!el) return;
    const ok = await apiHealth();
    el.textContent = ok ? 'online' : 'offline';
    el.classList.toggle('online', ok);
    el.classList.toggle('offline', !ok);
  }

  // =====================
  // Retry automático de backend
  // =====================
  // PT-BR: Quando o backend não responde, tentamos novamente em intervalos até voltar.
  // EN: When backend is down, keep retrying at intervals until it comes back.
  let backendRetryTimer = null;
  function startBackendRetry(intervalMs = 5000){
    if (backendRetryTimer) return; // PT-BR/EN: evita múltiplos timers
    async function attempt(){
      const ok = await apiHealth();
      if (ok){
        await syncFromServer();
        render();
        await updateStatus();
        const modal = document.getElementById('server-modal');
        if (modal) modal.setAttribute('aria-hidden', 'true');
        backendRetryTimer = null; // PT-BR/EN: libera para futuros retries se necessário
      } else {
        backendRetryTimer = setTimeout(attempt, intervalMs);
      }
    }
    attempt();
  }

  // =====================
  // Polling de fundo
  // =====================
  // PT-BR: Sincroniza periodicamente quando não há realtime.
  // EN: Periodic sync when realtime is not active.
  let pollTimer = setInterval(async () => { await syncFromServer(); render(); updateStatus(); }, POLL_MS);

  // =====================
  // Boot inicial
  // =====================
  (async () => {
    // PT-BR: Prepara primeira renderização (dados locais), depois tenta sincronizar do servidor.
    // EN: Prepare first paint (local data), then try syncing from the server.
    sliceLocalForPage();
    render();
    await syncFromServer();
    render();
    await updateStatus();

    // PT-BR: Se o backend estiver offline, mostramos o modal (quando localhost) e iniciamos retry.
    // EN: If backend is offline, show modal (when localhost) and start retry.
    const ok = await apiHealth();
    if (!ok){
      if (API_BASE.includes('localhost')){
        const modal = document.getElementById('server-modal');
        if (modal) modal.setAttribute('aria-hidden', 'false');
      }
      startBackendRetry(5000);
    }

    // PT-BR: Tenta habilitar realtime. Se ligar, desativa o polling para evitar duplicidade.
    // EN: Try enabling realtime. If active, disable polling to avoid duplication.
    const rt = await initRealtime();
    if (rt && pollTimer){ clearInterval(pollTimer); }
  })();
})();
