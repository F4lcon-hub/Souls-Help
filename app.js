(function(){
  'use strict';

  // Config
  const STORAGE_KEY = 'souls_help_requests_v1';
  const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4h
  // Backend base (quando servido via HTTP usa caminho relativo; em file:// aponta para localhost)
  const API_BASE = (typeof window !== 'undefined' && typeof window.__API_BASE__ === 'string' && window.__API_BASE__)
    ? window.__API_BASE__
    : (location.origin.startsWith('http') ? '' : 'http://localhost:3000');
  const POLL_MS = 15000; // sincronização periódica
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

  // State
  let items = load();
  let gameFilter = '';

  // Utils
  const now = () => Date.now();
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }

  // API helpers (com fallback silencioso)
  async function apiHealth(){
    const r = await fetch(HEALTH_URL).catch(()=>null);
    return !!(r && r.ok);
  }
  async function apiList(game){
    const url = `${API_BASE}/api/requests${game ? `?game=${encodeURIComponent(game)}` : ''}`;
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

  async function syncFromServer(){
    try {
      const list = await apiList(gameFilter);
      if (Array.isArray(list)) { items = list; save(); }
    } catch {}
  }

  function escapeHtml(s){
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtRemaining(ms){
    if (ms <= 0) return 'expirado';
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const ss = s%60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${ss}s`;
  }

  function pruneExpired(){
    const before = items.length;
    const t = now();
    items = items.filter(x => (x.expiresAt ?? 0) > t);
    if (items.length !== before) save();
  }

  // Rendering
  function render(){
    pruneExpired();

    const list = items
      .filter(x => !gameFilter || x.game === gameFilter)
      .sort((a,b) => a.expiresAt - b.expiresAt);

    requestsEl.innerHTML = list.map(renderItem).join('');
    emptyEl.style.display = list.length ? 'none' : 'block';
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
            <span class="countdown" title="Expira em">${fmtRemaining(left)}</span>
          </div>
        </div>
        <div class="request-content">
          <strong>Alvo:</strong> ${escapeHtml(x.target)}
          ${x.level ? ` • <strong>Nível:</strong> ${escapeHtml(x.level)}` : ''}
          ${x.region ? ` • <strong>Região:</strong> ${escapeHtml(x.region)}` : ''}
          ${x.password ? ` • <strong>Senha:</strong> ${escapeHtml(x.password)}` : ''}
        </div>
        ${notes}
        <div class="request-actions">
          <button class="btn" data-action="copy">Copiar detalhes</button>
          <button class="btn" data-action="share">Compartilhar</button>
          <button class="btn" data-action="remove">Remover</button>
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
    const map = { boss:'Derrotar chefe', area:'Explorar área', coop:'Coop PvE', pvp:'PvP', trade:'Troca', other:'Outro' };
    return map[code] || code;
  }
  function labelPlatform(code){
    const map = { ps:'PlayStation', xbox:'Xbox', pc:'PC' };
    return map[code] || code;
  }

  // Events
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!gameSelect.value || !reqType.value || !targetInput.value) return;

    const ttl = expire4h.checked ? DEFAULT_TTL_MS : 24*60*60*1000; // até 24h, se desmarcar

    // Monta entrada base
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

    // Tenta criar no backend, senão salva local
    try {
      const created = await apiCreate(baseEntry);
      items.unshift(created);
      save();
      render();
    } catch {
      const offline = { id: uid(), ...baseEntry };
      items.unshift(offline);
      save();
      render();
    }

    form.reset();
    // manter jogo selecionado para agilizar múltiplas entradas
    gameSelect.value = baseEntry.game;
  });

  requestsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const card = btn.closest('.request');
    if (!card) return;
    const id = card.getAttribute('data-id');
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;

    const action = btn.dataset.action;
    if (action === 'remove'){
      try { await apiDelete(id); } catch {}
      items.splice(idx,1); save(); render();
    } else if (action === 'copy'){
      const x = items[idx];
      const text = `Pedido de ajuda (${labelGame(x.game)} - ${labelType(x.type)})\nAlvo: ${x.target}\nPlataforma: ${labelPlatform(x.platform)}\n${x.level?`Nível: ${x.level}\n`:''}${x.region?`Região: ${x.region}\n`:''}${x.password?`Senha: ${x.password}\n`:''}${x.notes?`Obs: ${x.notes}\n`:''}`;
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copiado!'; setTimeout(()=>btn.textContent='Copiar detalhes', 1500);} catch {}
    } else if (action === 'share'){
      const x = items[idx];
      const text = `Ajuda em ${labelGame(x.game)} para ${labelType(x.type)} - Alvo: ${x.target}`;
      // Gera link de importação com os dados do pedido
      const payload = btoa(encodeURIComponent(JSON.stringify(x)));
      const link = `${location.origin}${location.pathname}?import=${payload}`;
      try {
        if (navigator.share){ await navigator.share({ title:'Souls Help', text, url: link }); }
        else { await navigator.clipboard.writeText(link); btn.textContent = 'Link copiado!'; setTimeout(()=>btn.textContent='Compartilhar', 1500);} 
      } catch {}
    }
  });

  filterGame.addEventListener('change', async () => {
    gameFilter = filterGame.value;
    await syncFromServer();
    render();
  });

  clearExpiredBtn.addEventListener('click', () => {
    const before = items.length;
    pruneExpired();
    if (items.length !== before){ render(); }
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
      if (left <= 0){ render(); }
    });
  }, 1000);

  // Modal helpers
  const modal = document.getElementById('server-modal');
  const confirmInput = document.getElementById('server-confirm');
  const cmdBox = document.getElementById('server-command');
  const copyBtn = document.getElementById('copy-server-cmd');
  const retryBtn = document.getElementById('server-retry');
  const dismissBtn = document.getElementById('server-dismiss');

  function openModal(){ if (modal) modal.setAttribute('aria-hidden', 'false'); }
  function closeModal(){ if (modal) modal.setAttribute('aria-hidden', 'true'); }

  confirmInput?.addEventListener('input', () => {
    const val = (confirmInput.value || '').trim().toUpperCase();
    cmdBox.style.display = (val === 'INICIAR') ? 'flex' : 'none';
  });
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('cd server && npm install && npm start');
      copyBtn.textContent = 'Copiado!'; setTimeout(()=> copyBtn.textContent = 'Copiar', 1500);
    } catch {}
  });
  retryBtn?.addEventListener('click', async () => {
    const ok = await apiHealth();
    if (ok){ closeModal(); await syncFromServer(); render(); }
  });
  dismissBtn?.addEventListener('click', () => closeModal());

  // Suggestions via Elden Ring Fan API (bosses & locations)
  // Fonte: https://eldenring.fanapis.com/api
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
            // Sanitiza e garante campos obrigatórios
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
        // Remove o parâmetro para evitar reimport em refresh
        if (location && location.pathname){
          history.replaceState(null, '', location.pathname);
        }
      }
    } catch {}
  })();

  // Sincronização com o servidor em background
  setInterval(async () => { await syncFromServer(); render(); }, POLL_MS);

  // Initial render
  render();

  // Primeira tentativa de sincronização + verificação de servidor
  (async () => {
    await syncFromServer(); render();
    const ok = await apiHealth();
    if (!ok && API_BASE.includes('localhost')){ openModal(); }
  })();
})();
