(function(){
  'use strict';

  // UI-only helpers for modals and quick actions
  // Independent from app.js logic

  // Info modal (How it works)
  (function(){
    const modal = document.getElementById('info-modal');
    if (!modal) return;
    const btn = document.getElementById('btn-info');
    const closeBtn = document.getElementById('info-close');
    const backdrop = modal.querySelector('.modal-backdrop');
    const open = () => modal.setAttribute('aria-hidden', 'false');
    const close = () => modal.setAttribute('aria-hidden', 'true');
    btn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  })();

  // Server modal (start local server helper)
  (async function(){
    const modal = document.getElementById('server-modal');
    if (!modal) return;
    const backdrop = modal.querySelector('.modal-backdrop');
    const input = document.getElementById('server-confirm');
    const cmd = document.getElementById('server-command');
    const copyBtn = document.getElementById('copy-server-cmd');
    const retryBtn = document.getElementById('server-retry');
    const dismissBtn = document.getElementById('server-dismiss');

    const close = () => modal.setAttribute('aria-hidden', 'true');

    input?.addEventListener('input', () => {
      const v = (input.value || '').trim().toUpperCase();
      cmd.style.display = v === 'START' ? 'flex' : 'none';
    });

    copyBtn?.addEventListener('click', async () => {
      try {
        const code = cmd?.querySelector('code')?.innerText || '';
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = 'Copied'; setTimeout(() => copyBtn.textContent = 'Copy', 1200);
      } catch {}
    });

    retryBtn?.addEventListener('click', async () => {
      // Check backend health; if OK hide modal and update badge quickly
      const ok = await (window.Shared?.apiHealth?.() ?? Promise.resolve(false));
      if (ok){
        // Update badge instantly; app.js will keep it in sync
        const badge = document.getElementById('api-status');
        if (badge){
          badge.textContent = 'online';
          badge.classList.add('online');
          badge.classList.remove('offline');
        }
        close();
      }
    });

    dismissBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  })();
})();
