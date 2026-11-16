'use strict';
/*
 * Fichas de jugadoras/es: fotos de las licencias guardadas SOLO en este dispositivo (IndexedDB).
 * No se envía nada a ningún servidor. Modo árbitro a pantalla completa para enseñar las fichas.
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const aviso = (m) => (window.toast ? window.toast(m) : console.log(m));

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
  function urlDe(f) {
    if (!urls.has(f.id)) urls.set(f.id, URL.createObjectURL(f.imagen));
    return urls.get(f.id);
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
  const ordenArbitro = (a, b) => (b.titular ? 1 : 0) - (a.titular ? 1 : 0) || porDorsal(nHoy)(a, b);

  const ordenar = (a, b) => {
    const da = parseInt(a.dorsal, 10); const db = parseInt(b.dorsal, 10);
    if (!isNaN(da) && !isNaN(db) && da !== db) return da - db;
    if (isNaN(da) !== isNaN(db)) return isNaN(da) ? 1 : -1;
    return (a.nombre || '').localeCompare(b.nombre || '', 'es') || a.creada - b.creada;
  };

  async function cargar() {
    F.lista = (await todas()).sort(ordenar);
    pintar();
  }

  // ------------------------------------------------------------------ Lista de fichas
  function pintar() {
    pintarPartido();
    const cont = $('#fLista');
    const conv = F.lista.filter((f) => f.convocada).length;
    const tit = F.lista.filter((f) => f.convocada && f.titular).length;
    $('#fResumen').textContent = F.lista.length
      ? `${F.lista.length} ${F.lista.length === 1 ? 'ficha' : 'fichas'} · ${conv} ${conv === 1 ? 'convocada' : 'convocadas'} · ${tit} ${tit === 1 ? 'titular' : 'titulares'}`
      : '';
    $('#btnArbitro').disabled = !F.lista.length;
    $('#fMarcar').hidden = !F.lista.length;
    $('#fNuevoPartido').hidden = !F.lista.length;
    if (!F.lista.length) {
      cont.innerHTML = `<div class="f-vacio">
        <strong>Todavía no hay fichas</strong>
        <p>Pulsa «Añadir fichas» y elige las fotos de las licencias desde la galería o haz una foto. Puedes seleccionar varias a la vez.</p>
      </div>`;
      return;
    }
    cont.innerHTML = F.lista.map((f) => `
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
      </article>`).join('');
  }

  $('#fLista').addEventListener('change', async (e) => {
    const art = e.target.closest('.f-ficha');
    const campo = e.target.dataset.campo;
    if (!art || !campo) return;
    const f = F.lista.find((x) => x.id === art.dataset.id);
    f[campo] = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim();
    if (campo === 'convocada' && !f.convocada) f.titular = false;
    await guardarFicha(f);
    if (campo === 'dorsal') F.lista.sort(ordenar);
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
    await borrarFicha(id);
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    F.lista = F.lista.filter((x) => x.id !== id);
    pintar();
    aviso('Ficha borrada de este móvil.');
  });

  $('#fFotos').addEventListener('change', async (e) => {
    const archivos = [...e.target.files];
    e.target.value = '';
    if (!archivos.length) return;
    aviso(`Guardando ${archivos.length} ${archivos.length === 1 ? 'ficha' : 'fichas'}…`);
    let n = 0;
    for (const a of archivos) {
      const f = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, nombre: '', dorsal: '', dorsalPartido: '', convocada: true, titular: false, creada: Date.now() + n++, imagen: await comprimir(a) };
      await guardarFicha(f);
      F.lista.push(f);
    }
    F.lista.sort(ordenar);
    pintar();
    aviso('Fichas guardadas. Escribe el dorsal y el nombre de cada una.');
  });

  $('#fMarcar').addEventListener('click', async () => {
    const todasMarcadas = F.lista.every((f) => f.convocada);
    for (const f of F.lista) { f.convocada = !todasMarcadas; await guardarFicha(f); }
    pintar();
  });

  // Nuevo partido: borra dorsales del día y titulares, y vuelve a convocar a todas
  $('#fNuevoPartido').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains('confirmar')) {
      b.classList.add('confirmar');
      b.textContent = '¿Empezar de cero? Toca otra vez';
      setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Nuevo partido'; }, 3000);
      return;
    }
    b.classList.remove('confirmar');
    b.textContent = 'Nuevo partido';
    for (const f of F.lista) { f.dorsalPartido = ''; f.titular = false; f.convocada = true; await guardarFicha(f); }
    $('#fRival').value = '';
    escribirLS('delegado.fRival', '');
    pintar();
    aviso('Listo para el nuevo partido: todas convocadas, sin titulares y con su dorsal habitual.');
  });

  ['fEquipo', 'fRival'].forEach((id) => {
    const i = $('#' + id);
    i.value = leerLS('delegado.' + id, '');
    i.addEventListener('input', () => escribirLS('delegado.' + id, i.value));
  });

  // ------------------------------------------------------------------ Modo árbitro
  async function pedirPantallaEncendida() {
    try { F.wake = await navigator.wakeLock?.request('screen'); } catch { F.wake = null; }
  }

  function abrirArbitro(idInicial) {
    const conv = F.lista.filter((f) => f.convocada);
    const A = F.arbitro;
    A.visibles = [...(conv.length ? conv : F.lista)].sort(ordenArbitro);
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

  function pintarArbitro() {
    const A = F.arbitro;
    const total = A.visibles.length;
    $('#aContador').textContent = `${total} ${total === 1 ? 'ficha' : 'fichas'}`;
    document.querySelectorAll('#aModo button').forEach((b) => b.classList.toggle('activo', b.dataset.modo === A.modo));
    const cuerpo = $('#aCuerpo');
    if (A.modo === 'cuadricula') {
      cuerpo.className = 'a-cuadricula';
      const hayTitulares = A.visibles.some((f) => f.titular);
      cuerpo.innerHTML = A.visibles.map((f, i) => {
        const separador = hayTitulares && i > 0 && A.visibles[i - 1].titular && !f.titular ? '<h3 class="a-grupo">Suplentes</h3>' : '';
        const cabecera = hayTitulares && i === 0 ? '<h3 class="a-grupo">Titulares</h3>' : '';
        return `${cabecera}${separador}
        <button class="a-mini" data-i="${i}">
          <img src="${urlDe(f)}" alt="Ficha ${esc(f.nombre)}">
          <span><b>${esc(nHoy(f) || '–')}</b> ${esc(f.nombre || 'Sin nombre')}${f.titular ? '<em>Titular</em>' : ''}</span>
        </button>`;
      }).join('');
    } else {
      const f = A.visibles[A.indice];
      cuerpo.className = 'a-una';
      cuerpo.innerHTML = `
        <div class="a-imagen"><img src="${urlDe(f)}" alt="Ficha ${esc(f.nombre)}"></div>
        <div class="a-pie">
          <button class="btn a-nav" id="aAnt" ${A.indice === 0 ? 'disabled' : ''} aria-label="Anterior">◀</button>
          <div class="a-quien"><b>${esc(nHoy(f) || '–')}</b> ${esc(f.nombre || 'Sin nombre')}${f.titular ? ' <em>Titular</em>' : ''}<small>${A.indice + 1} de ${total}</small></div>
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
  const CLAVE_P = 'delegado.partido';
  const P = (() => {
    const base = { parte: 1, duracion: 25, modo: 'crono', acumulado: 0, desde: null, eventos: [] };
    try { return { ...base, ...JSON.parse(leerLS(CLAVE_P, '{}')) }; } catch { return base; }
  })();
  const guardarP = () => escribirLS(CLAVE_P, JSON.stringify(P));
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

    const conv = F.lista.filter((f) => f.convocada);
    const jugadoras = [...(conv.length ? conv : F.lista)].sort(ordenArbitro);
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
    P.eventos.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, min: minutoActual(), parte: P.parte, ...ev });
    guardarP();
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
    if (v > 0 && v <= 60) { P.duracion = v; guardarP(); pintarReloj(); } else e.target.value = P.duracion;
  });
  $('#pModo').addEventListener('click', (e) => {
    const m = e.target.dataset.modo;
    if (m) { P.modo = m; guardarP(); pintarPartido(); }
  });
  $('#pTerminar').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains('confirmar')) {
      b.classList.add('confirmar'); b.textContent = '¿Borrar goles y reloj? Toca otra vez';
      setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Empezar partido nuevo'; }, 3000);
      return;
    }
    b.classList.remove('confirmar'); b.textContent = 'Empezar partido nuevo';
    P.parte = 1; P.acumulado = 0; P.desde = null; P.eventos = []; relojEncendido(false);
    guardarP(); pintarPartido();
    $('#pResumenTexto').hidden = true;
    aviso('Marcador y reloj a cero.');
  });

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

  // ------------------------------------------------------------------ Inicio
  (async function iniciar() {
    await abrirBD();
    if (!BD.ok) $('#fAvisoBD').hidden = false;
    try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
    await cargar();
  })();
})();
