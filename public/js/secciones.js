'use strict';
// Cambio entre secciones (Pizarra / Fichas / Partido / Club…). Recuerda la última abierta en este móvil.
// Cada botón con data-seccion="x" muestra el elemento con id "appX" (p. ej. club → appClub).
(function () {
  const CLAVE = 'delegado.seccion';
  const idDe = (nombre) => 'app' + nombre.charAt(0).toUpperCase() + nombre.slice(1);

  function mostrar(nombre) {
    if (!document.getElementById(idDe(nombre))) nombre = 'pizarra';
    document.querySelectorAll('#secciones button').forEach((b) => {
      const el = document.getElementById(idDe(b.dataset.seccion));
      if (el) el.hidden = b.dataset.seccion !== nombre;
      b.classList.toggle('activa', b.dataset.seccion === nombre);
    });
    try { localStorage.setItem(CLAVE, nombre); } catch { /* sin almacenamiento */ }
    window.scrollTo(0, 0);
  }
  window.mostrarSeccion = mostrar;
  window.seccionGuardada = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };

  document.getElementById('secciones').addEventListener('click', (e) => {
    const s = e.target.dataset.seccion;
    if (s) mostrar(s);
  });

  // Un enlace a una jugada (#id) abre la pizarra. Los enlaces de acceso (#access_token=…) no cuentan.
  let inicial = window.seccionGuardada() || 'fichas';
  if (location.hash.length > 1 && !location.hash.includes('=')) inicial = 'pizarra';
  mostrar(inicial);
})();
