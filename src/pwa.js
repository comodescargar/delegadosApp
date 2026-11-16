// App instalable y sin cobertura: registra el service worker y muestra dos avisos discretos:
// «Instala la app» (en iPhone, con instrucciones) y «Hay una versión nueva» (no recarga sola en mitad de un partido).
const CLAVE_OCULTO = 'delegado.instalarOculto';
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

function barra(id, html) {
  document.getElementById(id)?.remove();
  const b = document.createElement('div');
  b.id = id;
  b.className = 'pwa-barra';
  b.setAttribute('role', 'status');
  b.innerHTML = html;
  document.body.appendChild(b);
  return b;
}

// ---------------------------------------------------------------- Instalar
let peticionInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  peticionInstalar = e;
  if (instalada() || leer(CLAVE_OCULTO)) return;
  const b = barra('pwaInstalar', `<span><strong>Instala la app</strong> en el móvil: se abre aunque no haya cobertura en el campo.</span>
    <button class="btn primario" data-pwa="instalar">Instalar</button><button class="btn" data-pwa="ocultar">Ahora no</button>`);
  b.addEventListener('click', async (ev) => {
    const accion = ev.target.dataset.pwa;
    if (accion === 'instalar' && peticionInstalar) { peticionInstalar.prompt(); await peticionInstalar.userChoice; peticionInstalar = null; b.remove(); }
    if (accion === 'ocultar') { escribir(CLAVE_OCULTO, '1'); b.remove(); }
  });
});
window.addEventListener('appinstalled', () => document.getElementById('pwaInstalar')?.remove());

// iPhone/iPad no avisan: se explica cómo añadirla a la pantalla de inicio
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (esIOS && !instalada() && !leer(CLAVE_OCULTO)) {
  setTimeout(() => {
    const b = barra('pwaInstalar', `<span><strong>Instala la app</strong>: en Safari pulsa <strong>Compartir</strong> (el cuadrado con la flecha) y luego <strong>«Añadir a pantalla de inicio»</strong>. Así se abre aunque no haya cobertura.</span>
      <button class="btn" data-pwa="ocultar">Entendido</button>`);
    b.addEventListener('click', (ev) => { if (ev.target.dataset.pwa === 'ocultar') { escribir(CLAVE_OCULTO, '1'); b.remove(); } });
  }, 2500);
}

// ---------------------------------------------------------------- Service worker y versiones
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let recargarAlCambiar = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargarAlCambiar) { recargarAlCambiar = false; location.reload(); }
  });

  const avisarVersion = (sw) => {
    const b = barra('pwaVersion', `<span><strong>Hay una versión nueva</strong> de la app.</span>
      <button class="btn primario" data-pwa="actualizar">Actualizar</button><button class="btn" data-pwa="luego">Luego</button>`);
    b.addEventListener('click', (ev) => {
      const accion = ev.target.dataset.pwa;
      if (accion === 'actualizar') { recargarAlCambiar = true; sw.postMessage('actualizar'); b.remove(); }
      if (accion === 'luego') b.remove();
    });
  };

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (reg.waiting && navigator.serviceWorker.controller) avisarVersion(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        nuevo?.addEventListener('statechange', () => {
          // «installed» con un controlador previo = versión nueva esperando; sin él = primera instalación
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarVersion(nuevo);
        });
      });
      // Buscar versiones nuevas al volver a la app y cada hora
      document.addEventListener('visibilitychange', () => { if (!document.hidden && navigator.onLine) reg.update().catch(() => {}); });
      setInterval(() => { if (navigator.onLine) reg.update().catch(() => {}); }, 3600_000);
    } catch (e) {
      console.warn('No se ha podido activar el modo sin conexión', e);
    }
  });
}
