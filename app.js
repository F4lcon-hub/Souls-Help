(function(){
  'use strict';

  // Config
  const STORAGE_KEY = 'souls_help_requests_v1';
  const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4h
  // Backend base (when served via HTTP, use relative; in file:// fallback to localhost)
  const API_BASE = (typeof window !== 'undefined' && typeof window.__API_BASE__ === 'string' && window.__API_BASE__)
    ? window.__API_BASE__
    : (location.origin.startsWith('http') ? '' : 'http://localhost:3000');
  const POLL_MS = 15000; // periodic sync
  const HEALTH_URL = `${API_BASE}/api/health`;

  // Elements
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

  // Pagination UI (created dynamically)
  const pagination = document.createElement('div');
  pagination.id = 'pagination';
  pagination.className = 'actions';
  const pagePrev = document.createElement('button'); pagePrev.id = 'page-prev'; pagePrev.className = 'ghost'; pagePrev.type = 'button'; pagePrev.textContent = 'Previous';
  const pageInfo = document.createElement('span'); pageInfo.id = 'page-info'; pageInfo.className = 'page-info';
  const pageNext = document.createElement('button'); pageNext.id = 'page-next'; pageNext.className = 'ghost'; pageNext.type = 'button'; pageNext.textContent = 'Next';
  pagination.appendChild(pagePrev); pagination.appendChild(pageInfo); pagination.appendChild(pageNext);
  // Place after empty-state for layout
  if (emptyEl && emptyEl.parentNode){ emptyEl.parentNode.appendChild(pagination); }

  // State
  let items = load(); // local cache (used for offline fallback)
  let gameFilter = '';
  let currentPage = 1;
  let pageSize = 12; // default page size
  let total = 0;
  let pageCount = 1;

  // Utils
  const now = () => Date.now();
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }

  function escapeHtml(s){
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtRemaining(ms){
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
    const t = now();
    items = items.filter(x => (x.expiresAt ?? 0) > t);
  }

  function updatePaginationUI(){
    // Hide or show pagination based on total
    const shouldShow = total > pageSize;
    pagination.style.display = shouldShow ? 'flex' : 'none';
    pageCount = Math.max(1, Math.ceil(total / pageSize));
    pagePrev.disabled = currentPage <= 1;
    pageNext.disabled = currentPage >= pageCount;
    pageInfo.textContent = `Page ${currentPage} of ${pageCount}`;
  }

  // Rendering
  function render(){
    // For offline/local rendering, items already represent the current slice
    const list = items.slice();
    requestsEl.innerHTML = list.map(renderItem).join('');
    emptyEl.style.display = list.length ? 'none' : 'block';
    updatePaginationUI();
  }

  function renderItem(x){
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
    const map = {
      'elden-ring':'Elden Ring', 'ds1':'Dark Souls Remastered', 'ds2':'Dark Souls II', 'ds3':'Dark Souls III',
      'bb':'Bloodborne'
    };
    return map[code] || code;
  }
  function labelType(code){
    const map = { boss:'Defeat boss', area:'Explore area', coop:'Co-op PvE', pvp:'PvP', trade:'Trade', other:'Other' };
    return map[code] || code;
  }
  function labelPlatform(code){
    const map = { ps:'PlayStation', xbox:'Xbox', pc:'PC' };
    return map[code] || code;
  }

  // API helpers (with graceful fallback)
  async function apiHealth(){
    const r = await fetch(HEALTH_URL, { cache: 'no-store' }).catch(()=>null);
    return !!(r && r.ok);
  }
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
  async function apiCreate(entry){
    const r = await fetch(`${API_BASE}/api/requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
    }).catch(() => null);
    if (!r || !r.ok) throw new Error('create_failed');
    return r.json();
  }
  async function apiDelete(id){
    const r = await fetch(`${API_BASE}/api/requests/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    if (!r || (r.status !== 204 && r.status !== 404)) throw new Error('delete_failed');
  }

  function sliceLocalForPage(){
    // Build local filtered list and slice to current page
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
    try {
      const res = await apiList(gameFilter, currentPage, pageSize);
      if (Array.isArray(res)){
        // Back-compat (non-paginated response)
        // Emulate server-side pagination
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
      // Offline fallback: use local data
      sliceLocalForPage();
    }
  }

  // Events
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!gameSelect.value || !reqType.value || !targetInput.value) return;

    const ttl = expire4h.checked ? DEFAULT_TTL_MS : 24*60*60*1000; // up to 24h if unchecked

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
      // After create, reload page 1 to show newest first if desired; keep current page to minimize jump
      await syncFromServer();
      render();
    } catch {
      const offline = { id: uid(), ...baseEntry };
      items.unshift(offline);
      save();
      sliceLocalForPage();
      render();
    }

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
      try { await apiDelete(id); } catch {}
      items.splice(idx,1); save();
      await syncFromServer();
      render();
    } else if (action === 'copy'){
      const x = items[idx];
      const text = `Help request (${labelGame(x.game)} - ${labelType(x.type)})\nTarget: ${x.target}\nPlatform: ${labelPlatform(x.platform)}\n${x.level?`Level: ${x.level}\n`:''}${x.region?`Region: ${x.region}\n`:''}${x.password?`Password: ${x.password}\n`:''}${x.notes?`Notes: ${x.notes}\n`:''}`;
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied!'; setTimeout(()=>btn.textContent='Copy details', 1500);} catch {}
    } else if (action === 'share'){
      const x = items[idx];
      const text = `Help in ${labelGame(x.game)} for ${labelType(x.type)} - Target: ${x.target}`;
      // Share link import payload
      const payload = btoa(encodeURIComponent(JSON.stringify(x)));
      const link = `${location.origin}${location.pathname}?import=${payload}`;
      try {
        if (navigator.share){ await navigator.share({ title:'Souls Help', text, url: link }); }
        else { await navigator.clipboard.writeText(link); btn.textContent = 'Link copied!'; setTimeout(()=>btn.textContent='Share', 1500);} 
      } catch {}
    }
  });

  filterGame.addEventListener('change', async () => {
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
    pruneExpiredLocal();
    sliceLocalForPage();
    render();
  });

  // Countdown refresher
  setInterval(() => {
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

  // Suggestions via Elden Ring Fan API (bosses & locations)
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
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(async () => {
      const term = targetInput.value;
      const list = await fetchSuggestions(term);
      targetList.innerHTML = list.map(n => `<option value="${n}"></option>`).join('');
    }, 250);
  });

  // Import via URL parameter (?import=...)
  (function(){
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

  // Status indicator
  async function updateStatus(){
    const el = document.getElementById('api-status');
    if (!el) return;
    const ok = await apiHealth();
    el.textContent = ok ? 'online' : 'offline';
    el.classList.toggle('online', ok);
    el.classList.toggle('offline', !ok);
  }

  // Background sync
  setInterval(async () => { await syncFromServer(); render(); updateStatus(); }, POLL_MS);

  // Initial render + first sync
  (async () => {
    // prepare local slice for initial paint
    sliceLocalForPage();
    render();
    await syncFromServer();
    render();
    await updateStatus();
    const ok = await apiHealth();
    if (!ok && API_BASE.includes('localhost')){
      const modal = document.getElementById('server-modal');
      if (modal) modal.setAttribute('aria-hidden', 'false');
    }
  })();
})();
