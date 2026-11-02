(() => {
  const offline = document.querySelector('#offline-status');
  function connection() { offline.hidden = navigator.onLine; }
  window.addEventListener('online', connection);
  window.addEventListener('offline', connection);
  connection();
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    const status = document.querySelector('#pwa-status');
    const update = document.querySelector('#pwa-update');
    const ready = document.querySelector('#pwa-ready');
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) location.reload();
    });
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      function offerUpdate() {
        if (!registration.waiting || !navigator.serviceWorker.controller) return;
        status.hidden = false;
      }
      update.addEventListener('click', () => {
        if (!registration.waiting) return;
        refreshing = true;
        update.disabled = true;
        registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
      });
      offerUpdate();
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (installing) installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') offerUpdate();
        });
      });
      navigator.serviceWorker.ready.then(() => { ready.hidden = false; });
      // Recheck when returning to an app that may stay open for days.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    } catch {
      ready.textContent = 'Offline setup unavailable. You can continue using the site online.';
      ready.hidden = false;
    }
  });
})();
