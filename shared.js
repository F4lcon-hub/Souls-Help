(function(){
  'use strict';

  // Shared utilities between UI (ui.js) and App logic (app.js)
  // Expose a minimal global namespace: window.Shared

  // Compute backend base: honor window.__API_BASE__ when provided, otherwise
  // - if served over HTTP(S), use relative path (same origin)
  // - if opened via file://, default to localhost:3000
  const API_BASE = (typeof window !== 'undefined' && typeof window.__API_BASE__ === 'string' && window.__API_BASE__)
    ? window.__API_BASE__
    : (location.origin.startsWith('http') ? '' : 'http://localhost:3000');

  const HEALTH_URL = `${API_BASE}/api/health`;

  async function apiHealth(){
    const r = await fetch(HEALTH_URL, { cache: 'no-store' }).catch(()=>null);
    return !!(r && r.ok);
  }

  // Freeze to avoid accidental mutation at runtime
  window.Shared = Object.freeze({ API_BASE, HEALTH_URL, apiHealth });
})();
