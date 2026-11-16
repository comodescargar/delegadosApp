'use strict';
/*
 * Fichas de jugadoras/es y partido (marcador, reloj y goles).
 * Todo se guarda primero en este dispositivo (IndexedDB y localStorage), así funciona sin cobertura.
 * - Modo local (sin sesión): fichas sin equipo, solo en este móvil.
 * - Modo nube: la app de Supabase (src/sync.js) llama a FichasApp.usarEquipo(equipo, sincronizador);
 *   se muestran las fichas de ese equipo y cada cambio se avisa al sincronizador para subirlo.
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const aviso = (m) => (window.toast ? window.toast(m) : console.log(m));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  // Equipo activo (null = modo local) y sincronizador con la nube (null = sin sincronizar)
  const CTX = { equipoId: null, equipoNombre: '', sinc: null };
  const avisarSinc = (metodo, ...args) => { try { CTX.sinc?.[metodo]?.(...args); } catch (e) { console.error(e); } };

  // ------------------------------------------------------------------ Almacenamiento local
  const BD = { db: null, memoria: new Map(), ok: false };

  function abrirBD() {
    return new Promise((res) => {
      try {
        const pet = indexedDB.open('delegado-fichas', 1);
        pet.onupgradeneeded = () => pet.result.createObjectStore('fichas', { keyPath: 'id' });
        pet.onsuccess = () => { BD.db = pet.result; BD.ok = true; res(); };
        pet.onerror = () => res();
        pet.onblocked = () => res();
      } catch { res(); }
    });
  }
  function tx(modo) { return BD.db.transaction('fichas', modo).objectStore('fichas'); }
  function todas() {
    if (!BD.ok) return Promise.resolve([...BD.memoria.values()]);
    return new Promise((res) => {
      try {
        const p = tx('readonly').getAll();
        p.onsuccess = () => res(p.result || []);
        p.onerror = () => res([]);
      } catch { res([]); }
    });
  }
  function guardarFicha(f) {
    if (!BD.ok) { BD.memoria.set(f.id, f); return Promise.resolve(); }
    return new Promise((res) => {
      try { const p = tx('readwrite').put(f); p.onsuccess = () => res(); p.onerror = () => res(); } catch { res(); }
    });
  }
  function borrarFicha(id) {
    if (!BD.ok) { BD.memoria.delete(id); return Promise.resolve(); }
    return new Promise((res) => {
      try { const p = tx('readwrite').delete(id); p.onsuccess = () => res(); p.onerror = () => res(); } catch { res(); }
    });
  }
  const leerLS = (k, def) => { try { return localStorage.getItem(k) ?? def; } catch { return def; } };
  const escribirLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

  // ------------------------------------------------------------------ Imágenes
  async function comprimir(archivo) {
    try {
      const bmp = await createImageBitmap(archivo);
      const max = 1800;
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * k);
      cv.height = Math.round(bmp.height * k);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      bmp.close?.();
      return await new Promise((r) => cv.toBlob((b) => r(b || archivo), 'image/jpeg', 0.86));
    } catch {
      return archivo;
    }
  }

  const urls = new Map();
  // Si la foto aún no se ha descargado (sin conexión), se muestra un hueco gris
  const SIN_FOTO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#334155"/></svg>');
  function urlDe(f) {
    if (!f.imagen) return SIN_FOTO;
    if (!urls.has(f.id)) urls.set(f.id, URL.createObjectURL(f.imagen));
    return urls.get(f.id);
  }
  function olvidarImagen(id) {
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  }

  // ------------------------------------------------------------------ Estado
  const F = { lista: [], arbitro: { modo: 'cuadricula', indice: 0, visibles: [] }, wake: null };

  // Dorsal que lleva hoy: el del partido si se ha cambiado; si no, el habitual
  const nHoy = (f) => f.dorsalPartido || f.dorsal || '';
  const porDorsal = (campo) => (a, b) => {
    const da = parseInt(campo(a), 10); const db = parseInt(campo(b), 10);
    if (!isNaN(da) && !isNaN(db) && da !== db) return da - db;
    if (isNaN(da) !== isNaN(db)) return isNaN(da) ? 1 : -1;
    return (a.nombre || '').localeCompare(b.nombre || '', 'es') || a.creada - b.creada;
  };
  // Cuerpo técnico: sin dorsal ni titular; la foto puede ser la licencia o el DNI
  const CARGOS = {
    entrenador: 'Entrenador/a', segundo: '2º entrenador/a', delegado: 'Delegado/a',
    practicas: 'Entrenador/a en prácticas', auxiliar: 'Auxiliar',
  };
  const ORDEN_CARGOS = Object.keys(CARGOS);
  const esStaff = (f) => f.tipo === 'staff';
  const porCargo = (a, b) => ORDEN_CARGOS.indexOf(a.cargo) - ORDEN_CARGOS.indexOf(b.cargo)
    || (a.nombre || '').localeCompare(b.nombre || '', 'es') || a.creada - b.creada;
  // Jugadoras primero; después el cuerpo técnico por cargo
  const conStaffAlFinal = (orden) => (a, b) => (esStaff(a) - esStaff(b)) || (esStaff(a) ? porCargo(a, b) : orden(a, b));

  const ordenArbitro = conStaffAlFinal((a, b) => (b.titular ? 1 : 0) - (a.titular ? 1 : 0) || porDorsal(nHoy)(a, b));

  const ordenar = conStaffAlFinal((a, b) => {
    const da = parseInt(a.dorsal, 10); const db = parseInt(b.dorsal, 10);
    if (!isNaN(da) && !isNaN(db) && da !== db) return da - db;
    if (isNaN(da) !== isNaN(db)) return isNaN(da) ? 1 : -1;
    return (a.nombre || '').localeCompare(b.nombre || '', 'es') || a.creada - b.creada;
  });

  async function cargar() {
    F.lista = (await todas()).filter((f) => (f.equipoId || null) === CTX.equipoId).sort(ordenar);
    pintar();
  }

  // ------------------------------------------------------------------ Lista de fichas
  function pintar() {
    pintarPartido();
    const cont = $('#fLista');
    const jugadoras = F.lista.filter((f) => !esStaff(f));
    const staff = F.lista.filter(esStaff);
    const conv = jugadoras.filter((f) => f.convocada).length;
    const tit = jugadoras.filter((f) => f.convocada && f.titular).length;
    $('#fResumen').textContent = F.lista.length
      ? [`${jugadoras.length} ${jugadoras.length === 1 ? 'jugadora' : 'jugadoras'}`, `${conv} ${conv === 1 ? 'convocada' : 'convocadas'}`,
        `${tit} ${tit === 1 ? 'titular' : 'titulares'}`, staff.length ? `${staff.length} de cuerpo técnico` : ''].filter(Boolean).join(' · ')
      : '';
    $('#btnArbitro').disabled = !F.lista.length;
    $('#fMarcar').hidden = !jugadoras.length;
    $('#fNuevoPartido').hidden = !F.lista.length;
    if (!F.lista.length) {
      cont.innerHTML = `<div class="f-vacio">
        <strong>Todavía no hay fichas</strong>
        <p>Pulsa «Añadir fichas» y elige las fotos de las licencias desde la galería o haz una foto. Puedes seleccionar varias a la vez.
        Para entrenadores, delegados o entrenadores en prácticas, usa «Cuerpo técnico» (con su licencia o su DNI).</p>
      </div>`;
      return;
    }
    const tarjetaStaff = (f) => `
      <article class="f-ficha staff${f.convocada ? ' conv' : ''}" data-id="${f.id}">
        <button class="f-foto" data-ver="${f.id}" aria-label="Ver ficha en grande"><img src="${urlDe(f)}" alt="Ficha de ${esc(f.nombre || 'cuerpo técnico')}"></button>
        <div class="f-datos">
          <select class="f-cargo" id="cargo-${f.id}" data-campo="cargo" aria-label="Cargo">
            ${Object.entries(CARGOS).map(([k, v]) => `<option value="${k}"${f.cargo === k ? ' selected' : ''}>${v}</option>`).join('')}
          </select>
          <input class="f-nombre" id="nombre-${f.id}" data-campo="nombre" placeholder="Nombre y apellidos" value="${esc(f.nombre)}" aria-label="Nombre">
          <div class="f-hoy">
            <span class="f-hoy-et">Hoy</span>
            <label class="f-chip"><input type="checkbox" data-campo="convocada" ${f.convocada ? 'checked' : ''}> Va al partido</label>
          </div>
          <button class="f-borrar" data-borrar="${f.id}">Borrar ficha</button>
        </div>
      </article>`;
    cont.innerHTML = jugadoras.map((f) => `
      <article class="f-ficha${f.convocada ? ' conv' : ''}" data-id="${f.id}">
        <button class="f-foto" data-ver="${f.id}" aria-label="Ver ficha en grande"><img src="${urlDe(f)}" alt="Ficha de ${esc(f.nombre || 'jugadora')}"></button>
        <div class="f-datos">
          <div class="f-fila">
            <label class="f-num">Nº<input class="f-dorsal" id="dorsal-${f.id}" data-campo="dorsal" inputmode="numeric" maxlength="3" value="${esc(f.dorsal)}" aria-label="Dorsal habitual"></label>
            <input class="f-nombre" id="nombre-${f.id}" data-campo="nombre" placeholder="Nombre" value="${esc(f.nombre)}" aria-label="Nombre">
          </div>
          <div class="f-hoy">
            <span class="f-hoy-et">Hoy</span>
            <label class="f-num">Nº<input class="f-dorsal" id="dorsalp-${f.id}" data-campo="dorsalPartido" inputmode="numeric" maxlength="3" placeholder="${esc(f.dorsal || '–')}" value="${esc(f.dorsalPartido || '')}" aria-label="Dorsal en este partido"></label>
            <label class="f-chip"><input type="checkbox" data-campo="convocada" ${f.convocada ? 'checked' : ''}> Convocada</label>
            <label class="f-chip"><input type="checkbox" data-campo="titular" ${f.titular ? 'checked' : ''} ${f.convocada ? '' : 'disabled'}> Titular</label>
          </div>
          <button class="f-borrar" data-borrar="${f.id}">Borrar ficha</button>
        </div>
      </article>`).join('')
      + (staff.length ? `<h3 class="f-grupo">Cuerpo técnico</h3>${staff.map(tarjetaStaff).join('')}` : '');
  }

  $('#fLista').addEventListener('change', async (e) => {
    const art = e.target.closest('.f-ficha');
    const campo = e.target.dataset.campo;
    if (!art || !campo) return;
    const f = F.lista.find((x) => x.id === art.dataset.id);
    f[campo] = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim();
    if (campo === 'convocada' && !f.convocada) f.titular = false;
    await guardarFicha(f);
    avisarSinc('fichaCambiada', f, campo);
    if (campo === 'dorsal' || campo === 'cargo') F.lista.sort(ordenar);
    if (campo !== 'nombre') pintar();
  });

  $('#fLista').addEventListener('click', async (e) => {
    const ver = e.target.closest('[data-ver]');
    if (ver) { abrirArbitro(ver.dataset.ver); return; }
    const b = e.target.closest('[data-borrar]');
    if (!b) return;
    if (!b.classList.contains('confirmar')) {
      b.classList.add('confirmar');
      b.textContent = '¿Borrar? Toca otra vez';
      setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Borrar'; }, 3000);
      return;
    }
    const id = b.dataset.borrar;
    const ficha = F.lista.find((x) => x.id === id);
    await borrarFicha(id);
    olvidarImagen(id);
    F.lista = F.lista.filter((x) => x.id !== id);
    avisarSinc('fichaBorrada', ficha);
    pintar();
    aviso(CTX.sinc ? 'Ficha borrada del equipo.' : 'Ficha borrada de este móvil.');
  });

  async function anadirFichas(e, staff) {
    const archivos = [...e.target.files];
    e.target.value = '';
    if (!archivos.length) return;
    aviso(`Guardando ${archivos.length} ${archivos.length === 1 ? 'ficha' : 'fichas'}…`);
    let n = 0;
    for (const a of archivos) {
      const f = {
        id: uuid(), equipoId: CTX.equipoId, tipo: staff ? 'staff' : 'jugadora', cargo: staff ? 'entrenador' : null,
        nombre: '', dorsal: '', dorsalPartido: '', convocada: true, titular: false, creada: Date.now() + n++, imagen: await comprimir(a),
      };
      await guardarFicha(f);
      F.lista.push(f);
      avisarSinc('fichaCambiada', f, 'nueva');
    }
    F.lista.sort(ordenar);
    pintar();
    aviso(staff ? 'Fichas guardadas. Elige el cargo y escribe el nombre de cada persona.' : 'Fichas guardadas. Escribe el dorsal y el nombre de cada una.');
  }
  $('#fFotos').addEventListener('change', (e) => anadirFichas(e, false));
  $('#fFotosStaff').addEventListener('change', (e) => anadirFichas(e, true));

  // Convocar o desconvocar a todas las jugadoras (el cuerpo técnico no cambia)
  $('#fMarcar').addEventListener('click', async () => {
    const jugadoras = F.lista.filter((f) => !esStaff(f));
    const todasMarcadas = jugadoras.every((f) => f.convocada);
    for (const f of jugadoras) {
      f.convocada = !todasMarcadas;
      if (!f.convocada) f.titular = false;
      await guardarFicha(f);
      avisarSinc('fichaCambiada', f, 'convocada');
    }
    pintar();
  });

  // Nuevo partido: goles y reloj a cero, dorsales del día y titulares borrados, todas convocadas.
  // En modo nube, el siguiente cambio crea un partido nuevo en la base de datos (el anterior queda en el historial).
  async function nuevoPartido() {
    for (const f of F.lista) { f.dorsalPartido = ''; f.titular = false; f.convocada = true; await guardarFicha(f); }
    Object.assign(P, { parte: 1, acumulado: 0, desde: null, eventos: [], rival: '', partidoId: null, enlaceArbitro: null });
    relojEncendido(false);
    guardarP();
    $('#fRival').value = '';
    $('#pResumenTexto').hidden = true;
    avisarSinc('nuevoPartido');
    pintar();
    aviso('Nuevo partido: goles y reloj a cero, todas convocadas, sin titulares y con su dorsal habitual.');
  }
  function botonNuevoPartido(textoNormal) {
    return async (e) => {
      const b = e.currentTarget;
      if (!b.classList.contains('confirmar')) {
        b.classList.add('confirmar');
        b.textContent = '¿Empezar de cero? Toca otra vez';
        setTimeout(() => { b.classList.remove('confirmar'); b.textContent = textoNormal; }, 3000);
        return;
      }
      b.classList.remove('confirmar');
      b.textContent = textoNormal;
      await nuevoPartido();
    };
  }
  $('#fNuevoPartido').addEventListener('click', botonNuevoPartido('Nuevo partido'));

  // Nombre del equipo: en modo nube es el del equipo activo; en modo local se escribe a mano
  const fEquipo = $('#fEquipo');
  fEquipo.value = leerLS('delegado.fEquipo', '');
  fEquipo.addEventListener('input', () => { if (!CTX.equipoId) escribirLS('delegado.fEquipo', fEquipo.value); });
  // Rival: forma parte del partido actual
  $('#fRival').addEventListener('input', (e) => {
    P.rival = e.target.value;
    guardarP();
    avisarSinc('partidoCambiado');
  });

  // ------------------------------------------------------------------ Modo árbitro
  async function pedirPantallaEncendida() {
    try { F.wake = await navigator.wakeLock?.request('screen'); } catch { F.wake = null; }
  }

  function abrirArbitro(idInicial) {
    // Jugadoras convocadas (todas si no hay ninguna marcada) y cuerpo técnico que va al partido
    const jugadoras = F.lista.filter((f) => !esStaff(f));
    const conv = jugadoras.filter((f) => f.convocada);
    const staff = F.lista.filter((f) => esStaff(f) && f.convocada);
    const A = F.arbitro;
    A.visibles = [...(conv.length ? conv : jugadoras), ...staff].sort(ordenArbitro);
    if (idInicial && !A.visibles.some((f) => f.id === idInicial)) A.visibles = [...F.lista].sort(ordenArbitro);
    A.indice = Math.max(0, A.visibles.findIndex((f) => f.id === idInicial));
    A.modo = idInicial ? 'una' : 'cuadricula';
    const equipo = $('#fEquipo').value.trim(); const rival = $('#fRival').value.trim();
    $('#aTitulo').textContent = [equipo, rival].filter(Boolean).join(' · ') || 'Fichas del equipo';
    $('#arbitro').hidden = false;
    document.body.classList.add('sin-scroll');
    pedirPantallaEncendida();
    pintarArbitro();
  }

  function cerrarArbitro() {
    $('#arbitro').hidden = true;
    document.body.classList.remove('sin-scroll');
    try { F.wake?.release(); } catch { /* nada */ }
    F.wake = null;
  }

  // Dorsal y nombre para jugadoras; cargo y nombre para el cuerpo técnico
  const etiquetaArbitro = (f) => (esStaff(f)
    ? `${esc(f.nombre || 'Sin nombre')} <i class="a-cargo">${esc(CARGOS[f.cargo] || 'Cuerpo técnico')}</i>`
    : `<b>${esc(nHoy(f) || '–')}</b> ${esc(f.nombre || 'Sin nombre')}${f.titular ? ' <em>Titular</em>' : ''}`);

  function pintarArbitro() {
    const A = F.arbitro;
    const total = A.visibles.length;
    $('#aContador').textContent = `${total} ${total === 1 ? 'ficha' : 'fichas'}`;
    document.querySelectorAll('#aModo button').forEach((b) => b.classList.toggle('activo', b.dataset.modo === A.modo));
    const cuerpo = $('#aCuerpo');
    if (A.modo === 'cuadricula') {
      cuerpo.className = 'a-cuadricula';
      const hayTitulares = A.visibles.some((f) => f.titular && !esStaff(f));
      cuerpo.innerHTML = A.visibles.map((f, i) => {
        const ant = A.visibles[i - 1];
        let grupo = '';
        if (esStaff(f) && (!ant || !esStaff(ant))) grupo = '<h3 class="a-grupo">Cuerpo técnico</h3>';
        else if (!esStaff(f) && hayTitulares && i === 0) grupo = '<h3 class="a-grupo">Titulares</h3>';
        else if (!esStaff(f) && hayTitulares && ant?.titular && !f.titular) grupo = '<h3 class="a-grupo">Suplentes</h3>';
        return `${grupo}
        <button class="a-mini" data-i="${i}">
          <img src="${urlDe(f)}" alt="Ficha ${esc(f.nombre)}">
          <span>${etiquetaArbitro(f)}</span>
        </button>`;
      }).join('');
    } else {
      const f = A.visibles[A.indice];
      cuerpo.className = 'a-una';
      cuerpo.innerHTML = `
        <div class="a-imagen"><img src="${urlDe(f)}" alt="Ficha ${esc(f.nombre)}"></div>
        <div class="a-pie">
          <button class="btn a-nav" id="aAnt" ${A.indice === 0 ? 'disabled' : ''} aria-label="Anterior">◀</button>
          <div class="a-quien">${etiquetaArbitro(f)}<small>${A.indice + 1} de ${total}</small></div>
          <button class="btn a-nav" id="aSig" ${A.indice >= total - 1 ? 'disabled' : ''} aria-label="Siguiente">▶</button>
        </div>`;
      $('#aAnt').onclick = () => mover(-1);
      $('#aSig').onclick = () => mover(1);
    }
  }

  function mover(d) {
    const A = F.arbitro;
    A.indice = Math.max(0, Math.min(A.visibles.length - 1, A.indice + d));
    pintarArbitro();
  }

  $('#aCuerpo').addEventListener('click', (e) => {
    const m = e.target.closest('[data-i]');
    if (m) { F.arbitro.indice = Number(m.dataset.i); F.arbitro.modo = 'una'; pintarArbitro(); }
  });
  $('#aModo').addEventListener('click', (e) => {
    const m = e.target.dataset.modo;
    if (m) { F.arbitro.modo = m; pintarArbitro(); }
  });
  $('#aCerrar').addEventListener('click', cerrarArbitro);
  $('#btnArbitro').addEventListener('click', () => abrirArbitro());

  // Deslizar para pasar ficha
  let x0 = null;
  $('#aCuerpo').addEventListener('touchstart', (e) => { if (F.arbitro.modo === 'una') x0 = e.touches[0].clientX; }, { passive: true });
  $('#aCuerpo').addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', (e) => {
    if ($('#arbitro').hidden) return;
    if (e.key === 'Escape') cerrarArbitro();
    if (F.arbitro.modo === 'una' && e.key === 'ArrowRight') mover(1);
    if (F.arbitro.modo === 'una' && e.key === 'ArrowLeft') mover(-1);
  });

  // ------------------------------------------------------------------ Partido: marcador, reloj y goles
  // Un partido por equipo (en modo local, uno solo). partidoId = id del partido en la nube.
  const claveP = () => 'delegado.partido' + (CTX.equipoId ? '.' + CTX.equipoId : '');
  let P = {};
  function cargarP() {
    const base = { parte: 1, duracion: 25, modo: 'crono', acumulado: 0, desde: null, eventos: [], rival: '', partidoId: null };
    let guardado = {};
    try { guardado = JSON.parse(leerLS(claveP(), '{}')) || {}; } catch { guardado = {}; }
    // Versión 0: el rival se guardaba aparte
    if (!CTX.equipoId && guardado.rival === undefined) guardado.rival = leerLS('delegado.fRival', '');
    P = { ...base, ...guardado };
    $('#fRival').value = P.rival || '';
  }
  const guardarP = () => escribirLS(claveP(), JSON.stringify(P));
  cargarP();
  const msJugados = () => P.acumulado + (P.desde ? Date.now() - P.desde : 0);
  const mmss = (ms) => {
    const s = Math.floor(Math.abs(ms) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const minutoActual = () => Math.min(P.duracion + 15, Math.floor(msJugados() / 60000) + 1);
  const nomParte = (n) => `${n}ª parte`;
  const nombreEquipo = () => $('#fEquipo').value.trim() || 'Nosotras';
  const nombreRival = () => {
    const r = $('#fRival').value.trim();
    return r ? r.split(/[,·(]/)[0].trim() || r : 'Rival';
  };

  function pintarReloj() {
    const ms = msJugados();
    const durMs = P.duracion * 60000;
    const reloj = $('#pReloj');
    if (P.modo === 'atras') {
      const resto = durMs - ms;
      reloj.textContent = (resto < 0 ? '+' : '') + mmss(resto);
    } else {
      reloj.textContent = mmss(ms);
    }
    reloj.classList.toggle('pasado', ms >= durMs);
    $('#pParte').textContent = `${nomParte(P.parte)} · ${P.duracion} min`;
    $('#pPlay').textContent = P.desde ? '⏸ Pausar' : (ms > 0 ? '▶ Seguir' : '▶ Iniciar');
  }

  function pintarPartido() {
    const nuestros = P.eventos.filter((e) => e.tipo === 'gol').length;
    const rival = P.eventos.filter((e) => e.tipo === 'rival').length;
    $('#pGolesNuestros').textContent = nuestros;
    $('#pGolesRival').textContent = rival;
    $('#pNomNuestro').textContent = nombreEquipo();
    $('#pNomRival').textContent = nombreRival();
    $('#pDuracion').value = P.duracion;
    document.querySelectorAll('#pModo button').forEach((b) => b.classList.toggle('activo', b.dataset.modo === P.modo));
    pintarReloj();

    // Solo jugadoras pueden marcar (el cuerpo técnico no sale en la lista)
    const todasJug = F.lista.filter((f) => !esStaff(f));
    const conv = todasJug.filter((f) => f.convocada);
    const jugadoras = [...(conv.length ? conv : todasJug)].sort(ordenArbitro);
    const golesDe = (id) => P.eventos.filter((e) => e.tipo === 'gol' && e.fichaId === id).length;
    $('#pGoleadoras').innerHTML = jugadoras.length
      ? jugadoras.map((f) => {
        const g = golesDe(f.id);
        return `<button class="gol-btn${f.titular ? ' tit' : ''}" data-gol="${f.id}" aria-label="Gol de ${esc(f.nombre || 'dorsal ' + nHoy(f))}">
          <b>${esc(nHoy(f) || '–')}</b><span>${esc(f.nombre || 'Sin nombre')}</span>${g ? `<i>⚽ ${g}</i>` : ''}</button>`;
      }).join('')
      : '<p class="nota">Añade las fichas en la pestaña «Fichas» para apuntar los goles de cada jugadora. Mientras tanto puedes usar «+ Gol sin asignar».</p>';

    const ev = [...P.eventos].reverse();
    $('#pEventos').innerHTML = ev.length
      ? ev.map((e) => `<div class="evento${e.tipo === 'rival' ? ' rival' : ''}">
          <span class="min">${e.min}' · ${e.parte}ª</span>
          <span class="que">${e.tipo === 'rival' ? `Gol de ${esc(nombreRival())}` : `⚽ ${e.dorsal ? `<b>${esc(e.dorsal)}</b> ` : ''}${esc(e.nombre || 'Gol nuestro')}`}</span>
          <button data-quitar="${e.id}">Quitar</button>
        </div>`).join('')
      : '<p class="nota">Aún no hay goles. Cada gol queda apuntado con su minuto y parte.</p>';
  }

  function apuntar(ev) {
    const evento = { id: uuid(), min: minutoActual(), parte: P.parte, ...ev };
    P.eventos.push(evento);
    guardarP();
    avisarSinc('eventoNuevo', evento);
    pintarPartido();
    try { navigator.vibrate?.(60); } catch { /* opcional */ }
  }

  $('#pGoleadoras').addEventListener('click', (e) => {
    const b = e.target.closest('[data-gol]');
    if (!b) return;
    const f = F.lista.find((x) => x.id === b.dataset.gol);
    apuntar({ tipo: 'gol', fichaId: f.id, dorsal: nHoy(f), nombre: f.nombre });
    aviso(`⚽ Gol de ${f.nombre || 'la ' + nHoy(f)} (${minutoActual()}')`);
  });
  $('#pGolSinAsignar').addEventListener('click', () => apuntar({ tipo: 'gol', fichaId: null, dorsal: '', nombre: '' }));
  $('#pGolRival').addEventListener('click', () => apuntar({ tipo: 'rival' }));
  $('#pEventos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar]');
    if (!b) return;
    if (!b.classList.contains('confirmar')) {
      b.classList.add('confirmar');
      b.textContent = '¿Quitar?';
      setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Quitar'; }, 3000);
      return;
    }
    P.eventos = P.eventos.filter((x) => x.id !== b.dataset.quitar);
    guardarP();
    avisarSinc('eventoBorrado', b.dataset.quitar);
    pintarPartido();
  });

  async function relojEncendido(si) {
    if (si && !F.wakeReloj) { try { F.wakeReloj = await navigator.wakeLock?.request('screen'); } catch { F.wakeReloj = null; } }
    if (!si && F.wakeReloj) { try { F.wakeReloj.release(); } catch { /* nada */ } F.wakeReloj = null; }
  }
  $('#pPlay').addEventListener('click', () => {
    if (P.desde) { P.acumulado += Date.now() - P.desde; P.desde = null; relojEncendido(false); }
    else { P.desde = Date.now(); relojEncendido(true); }
    guardarP(); pintarReloj();
  });
  $('#pSigParte').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains('confirmar')) {
      b.classList.add('confirmar'); b.textContent = `¿Empezar ${nomParte(P.parte + 1)}?`;
      setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Siguiente parte'; }, 3000);
      return;
    }
    b.classList.remove('confirmar'); b.textContent = 'Siguiente parte';
    P.parte += 1; P.acumulado = 0; P.desde = null; relojEncendido(false);
    guardarP(); pintarPartido();
  });
  $('#pReiniciarReloj').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains('confirmar')) {
      b.classList.add('confirmar'); b.textContent = '¿Seguro? Toca otra vez';
      setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Poner reloj a 0'; }, 3000);
      return;
    }
    b.classList.remove('confirmar'); b.textContent = 'Poner reloj a 0';
    P.acumulado = 0; P.desde = null; relojEncendido(false);
    guardarP(); pintarReloj();
  });
  $('#pDuracion').addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10);
    if (v > 0 && v <= 60) { P.duracion = v; guardarP(); avisarSinc('partidoCambiado'); pintarReloj(); } else e.target.value = P.duracion;
  });
  $('#pModo').addEventListener('click', (e) => {
    const m = e.target.dataset.modo;
    if (m) { P.modo = m; guardarP(); pintarPartido(); }
  });
  $('#pTerminar').addEventListener('click', botonNuevoPartido('Empezar partido nuevo'));

  function textoResumen() {
    const nuestros = P.eventos.filter((e) => e.tipo === 'gol');
    const rival = P.eventos.filter((e) => e.tipo === 'rival').length;
    const lineas = [`⚽ ${nombreEquipo()} ${nuestros.length} - ${rival} ${nombreRival()}`];
    if ($('#fRival').value.trim()) lineas.push($('#fRival').value.trim());
    if (nuestros.length) {
      lineas.push('', 'Goles:');
      nuestros.forEach((e) => lineas.push(`• ${e.min}' (${e.parte}ª) ${[e.dorsal, e.nombre].filter(Boolean).join(' ') || 'Gol'}`));
    }
    return lineas.join('\n');
  }
  $('#pCopiar').addEventListener('click', () => {
    const t = textoResumen();
    const area = $('#pResumenTexto');
    area.value = t;
    const mostrar = () => { area.hidden = false; area.focus(); area.select(); aviso('Selecciona el texto y cópialo.'); };
    try {
      navigator.clipboard.writeText(t).then(() => aviso('Resumen copiado. Pégalo en WhatsApp.'), mostrar);
    } catch { mostrar(); }
  });

  $('#fEquipo').addEventListener('input', pintarPartido);
  $('#fRival').addEventListener('input', pintarPartido);
  setInterval(() => { if (!$('#appPartido').hidden) pintarReloj(); }, 500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && P.desde) relojEncendido(true); });

  // ------------------------------------------------------------------ Pasar fichas entre apps (copiar y pegar)
  // Sirve para llevar las fichas de la versión antigua (o de otro móvil) a la app del club:
  // se copian como texto (con las fotos reducidas) y se pegan en la otra app.
  const PREFIJO = 'DELEGADO-FICHAS-v1:';
  const panelPasar = $('#fPasarPanel');
  let textoCopia = '';

  async function fotoATexto(blob) {
    try {
      const bmp = await createImageBitmap(blob);
      const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * k);
      cv.height = Math.round(bmp.height * k);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      bmp.close?.();
      return cv.toDataURL('image/jpeg', 0.75);
    } catch {
      return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(blob); });
    }
  }

  $('#fCopiar').addEventListener('click', async () => {
    if (!F.lista.length) { aviso('No hay fichas que copiar en esta app.'); return; }
    panelPasar.hidden = false;
    panelPasar.innerHTML = `<p>Preparando ${F.lista.length} fichas…</p>`;
    const fichas = [];
    for (const f of F.lista) {
      fichas.push({
        tipo: esStaff(f) ? 'staff' : 'jugadora', cargo: esStaff(f) ? f.cargo || 'entrenador' : null,
        nombre: f.nombre || '', dorsal: esStaff(f) ? '' : f.dorsal || '', imagen: f.imagen ? await fotoATexto(f.imagen) : null,
      });
    }
    textoCopia = PREFIJO + JSON.stringify({ v: 1, fichas });
    const tam = textoCopia.length > 1048576 ? `${(textoCopia.length / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(textoCopia.length / 1024))} KB`;
    panelPasar.innerHTML = `<p>Listas <strong>${fichas.length} fichas</strong> (${tam}). Pulsa el botón y después, en la otra app, «Pegar fichas».</p>
      <div class="barra-acc"><button class="btn primario" id="fCopiarYa">Copiar al portapapeles</button></div>
      <textarea class="entrada" id="fCopiarTexto" readonly hidden aria-label="Texto de las fichas"></textarea>`;
  });

  // Huella corta de un texto largo (FNV-1a de 32 bits), para reconocer la misma foto
  function huella(texto) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16) + ':' + texto.length;
  }

  async function textoAFoto(dataUrl) {
    if (!dataUrl) return null;
    try {
      const [cabecera, base64] = dataUrl.split(',');
      const tipo = (cabecera.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: tipo });
    } catch { return null; }
  }

  async function importarFichas(texto) {
    texto = (texto || '').trim();
    const i = texto.indexOf(PREFIJO);
    if (i < 0) { aviso('Ese texto no son fichas copiadas desde la app. Vuelve a pulsar «Copiar fichas» en la otra app.'); return; }
    let datos;
    try { datos = JSON.parse(texto.slice(i + PREFIJO.length)); } catch { aviso('El texto está incompleto. Vuelve a copiarlo en la otra app.'); return; }
    // Una ficha se considera repetida si ya se pegó la misma foto (huella de la imagen).
    // Si no hay foto, solo si coinciden nombre y dorsal/cargo y el nombre no está vacío.
    const huellaDe = (d) => (d.imagen ? `img:${huella(d.imagen)}` : null);
    const claveSinFoto = (f) => ((f.nombre || '').trim()
      ? `sin:${f.tipo === 'staff' ? 'staff' : 'jugadora'}|${f.nombre.trim().toLowerCase()}|${f.tipo === 'staff' ? f.cargo : f.dorsal || ''}` : null);
    const existentes = new Set(F.lista.flatMap((f) => [f.huella, f.imagen ? null : claveSinFoto(f)]).filter(Boolean));
    let nuevas = 0; let repetidas = 0;
    for (const d of datos.fichas || []) {
      const clave = huellaDe(d) || claveSinFoto(d);
      if (clave && existentes.has(clave)) { repetidas++; continue; }
      const staff = d.tipo === 'staff';
      const f = {
        id: uuid(), equipoId: CTX.equipoId, tipo: staff ? 'staff' : 'jugadora', cargo: staff ? d.cargo || 'entrenador' : null,
        nombre: d.nombre || '', dorsal: staff ? '' : d.dorsal || '', dorsalPartido: '', convocada: true, titular: false,
        creada: Date.now() + nuevas, imagen: await textoAFoto(d.imagen), huella: huellaDe(d),
      };
      await guardarFicha(f);
      F.lista.push(f);
      if (clave) existentes.add(clave);
      avisarSinc('fichaCambiada', f, 'nueva');
      nuevas++;
    }
    F.lista.sort(ordenar);
    pintar();
    panelPasar.hidden = true;
    const destino = CTX.equipoId ? ` a ${CTX.equipoNombre}` : '';
    aviso(`${nuevas} ${nuevas === 1 ? 'ficha añadida' : 'fichas añadidas'}${destino}${repetidas ? ` (${repetidas} ya estaban)` : ''}.`);
  }

  $('#fPegar').addEventListener('click', () => {
    panelPasar.hidden = false;
    panelPasar.innerHTML = `<p>${CTX.equipoId ? `Las fichas se añadirán a <strong>${esc(CTX.equipoNombre)}</strong> y se subirán a la nube.`
      : 'No tienes sesión iniciada: las fichas se guardarán solo en este móvil. Para el equipo, entra antes en «Club».'}</p>
      <div class="barra-acc"><button class="btn primario" id="fPegarPortapapeles">Pegar del portapapeles</button></div>
      <p class="nota">Si el botón no funciona, mantén pulsado el recuadro, elige «Pegar» y pulsa «Importar».</p>
      <textarea class="entrada" id="fPegarTexto" placeholder="Pega aquí el texto copiado" aria-label="Texto de las fichas"></textarea>
      <div class="barra-acc"><button class="btn" id="fImportar">Importar</button></div>`;
  });

  panelPasar.addEventListener('click', async (e) => {
    const id = e.target.id;
    if (id === 'fCopiarYa') {
      const area = $('#fCopiarTexto');
      try {
        await navigator.clipboard.writeText(textoCopia);
        aviso('Fichas copiadas. Abre la otra app y pulsa «Pegar fichas».');
      } catch {
        area.hidden = false;
        area.value = textoCopia;
        area.focus();
        area.select();
        aviso('No se ha podido copiar solo: el texto está seleccionado, mantén pulsado y elige «Copiar».');
      }
    }
    if (id === 'fPegarPortapapeles') {
      try {
        const texto = await navigator.clipboard.readText();
        e.target.disabled = true;
        e.target.textContent = 'Importando…';
        await importarFichas(texto);
      } catch {
        aviso('No se ha podido leer el portapapeles. Pega el texto en el recuadro y pulsa «Importar».');
      }
    }
    if (id === 'fImportar') {
      e.target.disabled = true;
      await importarFichas($('#fPegarTexto').value);
      e.target.disabled = false;
    }
  });

  // ------------------------------------------------------------------ API para la sincronización (src/sync.js)
  let marcarListo;
  window.FichasApp = {
    listo: new Promise((r) => { marcarListo = r; }),
    uuid,
    equipoActivo: () => CTX.equipoId,
    // Cambia de equipo (null = modo local) y de sincronizador
    async usarEquipo(equipo, sinc) {
      CTX.equipoId = equipo?.id || null;
      CTX.equipoNombre = equipo?.nombre || '';
      CTX.sinc = sinc || null;
      fEquipo.readOnly = !!CTX.equipoId;
      fEquipo.value = CTX.equipoId ? CTX.equipoNombre : leerLS('delegado.fEquipo', '');
      cargarP();
      await cargar();
    },
    todasLocales: todas,
    guardarLocal: guardarFicha,
    borrarLocal: borrarFicha,
    olvidarImagen,
    // Vuelve a leer las fichas del equipo activo; no repinta si se está escribiendo en una ficha
    async recargar() {
      if (document.activeElement?.closest?.('#fLista')) return false;
      await cargar();
      return true;
    },
    partido: () => P,
    guardarPartido() { guardarP(); $('#fRival').value = P.rival || ''; pintarPartido(); },
  };

  // ------------------------------------------------------------------ Inicio
  (async function iniciar() {
    await abrirBD();
    if (!BD.ok) $('#fAvisoBD').hidden = false;
    try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
    await cargar();
    marcarListo();
  })();
})();
