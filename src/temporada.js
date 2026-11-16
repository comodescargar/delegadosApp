// Pestaña «Temporada»: historial de partidos, resultados, goleadoras, convocatorias y titularidades
// del equipo activo, leídos de la nube. Gráficos en SVG propio (sin librerías).
import './temporada.css';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v) => Math.round(v * 10) / 10;

export function crearTemporada(sb, { equipoActivo, partidoActualId }) {
  const boton = document.createElement('button');
  boton.dataset.seccion = 'temporada';
  boton.textContent = 'Temporada';
  document.getElementById('secciones').insertBefore(boton, document.querySelector('#secciones [data-seccion="club"]'));

  const seccion = document.createElement('section');
  seccion.className = 'seccion';
  seccion.id = 'appTemporada';
  seccion.hidden = true;
  seccion.innerHTML = '<div class="contenedor t-cont" id="tCuerpo"></div><div class="t-tip" id="tTip" role="tooltip" hidden></div>';
  document.getElementById('appPartido').after(seccion);
  const cuerpo = seccion.querySelector('#tCuerpo');
  const tip = seccion.querySelector('#tTip');
  const E = { datos: null, orden: { campo: 'conv', desc: true }, abiertos: new Set() };

  boton.addEventListener('click', () => cargar());

  // ---------------------------------------------------------------- Datos
  async function cargar() {
    const eq = equipoActivo();
    if (!eq) {
      cuerpo.innerHTML = `<div class="t-vacio"><strong>Elige un equipo</strong><p>La temporada se calcula con los partidos guardados en la nube. Entra en «Club» y elige tu equipo.</p></div>`;
      return;
    }
    if (!E.datos || E.datos.equipoId !== eq.id) cuerpo.innerHTML = '<p class="nota">Cargando la temporada…</p>';
    try {
      const pa = await sb.from('partidos').select('id, rival, fecha, minutos_parte, creado_en').eq('equipo_id', eq.id).order('creado_en', { ascending: true });
      if (pa.error) throw pa.error;
      const ids = pa.data.map((p) => p.id);
      const vacio = { data: [], error: null };
      const [ev, co, fi] = await Promise.all([
        ids.length ? sb.from('eventos').select('partido_id, tipo, ficha_id, ficha_entra, minuto, parte, segundo').in('partido_id', ids) : vacio,
        ids.length ? sb.from('convocatorias').select('partido_id, ficha_id, titular, segundos_jugados').in('partido_id', ids) : vacio,
        sb.from('fichas').select('id, dorsal, tipo, cargo, activa, jugadoras(nombre)').eq('equipo_id', eq.id),
      ]);
      for (const r of [ev, co, fi]) if (r.error) throw r.error;
      E.datos = calcular(eq, pa.data, ev.data, co.data, fi.data);
      pintar();
    } catch (e) {
      cuerpo.innerHTML = `<div class="t-vacio"><strong>No se ha podido cargar la temporada</strong><p>${esc(e.message || 'Revisa la conexión')} · Vuelve a abrir la pestaña para reintentar.</p></div>`;
    }
  }

  function calcular(eq, partidos, eventos, convocatorias, fichas) {
    const fichaPorId = Object.fromEntries(fichas.map((f) => [f.id, f]));
    const actual = partidoActualId();
    const lista = partidos.map((p, i) => {
      const ev = eventos.filter((e) => e.partido_id === p.id);
      const co = convocatorias.filter((c) => c.partido_id === p.id);
      const gf = ev.filter((e) => e.tipo === 'gol').length;
      const gc = ev.filter((e) => e.tipo === 'gol_rival').length;
      const goleadoras = {};
      ev.filter((e) => e.tipo === 'gol').forEach((e) => { const k = e.ficha_id || '_'; goleadoras[k] = (goleadoras[k] || 0) + 1; });
      const esActual = p.id === actual && i === partidos.length - 1;
      return {
        ...p, gf, gc, ev, co, goleadoras, esActual,
        resultado: gf > gc ? 'V' : gf < gc ? 'D' : 'E',
        // Un partido cuenta si tiene goles, o si tiene convocatoria y ya no es el actual
        cuenta: ev.length > 0 || (co.length > 0 && !esActual),
      };
    }).filter((p) => p.ev.length || p.co.length);

    const jugados = lista.filter((p) => p.cuenta);
    const totales = {
      pj: jugados.length,
      v: jugados.filter((p) => p.resultado === 'V').length,
      e: jugados.filter((p) => p.resultado === 'E').length,
      d: jugados.filter((p) => p.resultado === 'D').length,
      gf: jugados.reduce((s, p) => s + p.gf, 0),
      gc: jugados.reduce((s, p) => s + p.gc, 0),
    };

    const porJugadora = {};
    const fila = (id) => {
      if (!porJugadora[id]) {
        const f = fichaPorId[id];
        porJugadora[id] = { id, nombre: f?.jugadoras?.nombre || 'Sin nombre', dorsal: f?.dorsal || '', tipo: f?.tipo || 'jugadora', cargo: f?.cargo, activa: f?.activa !== false, conv: 0, tit: 0, goles: 0, seg: 0, am: 0, ro: 0 };
      }
      return porJugadora[id];
    };
    fichas.filter((f) => f.tipo !== 'staff' && f.activa !== false).forEach((f) => fila(f.id));
    for (const p of jugados) {
      p.co.forEach((c) => {
        if (fichaPorId[c.ficha_id]?.tipo === 'staff') return;
        const j = fila(c.ficha_id); j.conv++; if (c.titular) j.tit++; j.seg += c.segundos_jugados || 0;
      });
      p.ev.filter((e) => e.ficha_id).forEach((e) => {
        if (e.tipo === 'gol') fila(e.ficha_id).goles++;
        if (e.tipo === 'amarilla') fila(e.ficha_id).am++;
        if (e.tipo === 'roja') fila(e.ficha_id).ro++;
      });
    }
    const jugadoras = Object.values(porJugadora).filter((j) => j.tipo !== 'staff');
    return { equipoId: eq.id, equipo: eq.nombre, lista, totales, jugadoras, fichaPorId };
  }

  // ---------------------------------------------------------------- Pintado
  function pintar() {
    const D = E.datos;
    const T = D.totales;
    if (!D.lista.length) {
      cuerpo.innerHTML = `<div class="t-vacio"><strong>Aún no hay partidos guardados</strong>
        <p>Cada partido se guarda al usar Fichas y Partido con sesión iniciada: la convocatoria, los titulares y los goles.
        Pulsa «Nuevo partido» al empezar cada jornada y aquí verás la temporada de ${esc(D.equipo)}.</p></div>`;
      return;
    }
    const pendiente = D.lista.find((p) => p.esActual && !p.cuenta);
    cuerpo.innerHTML = `
      <div class="cab"><div><h1>Temporada</h1><p class="nota">${esc(D.equipo)} · ${T.pj} ${T.pj === 1 ? 'partido jugado' : 'partidos jugados'}</p></div>
        <button class="btn" id="tRecargar">Actualizar</button></div>
      ${pintarResumen(T, D.lista.filter((p) => p.cuenta))}
      ${pendiente ? '<p class="nota">El partido actual se sumará cuando tenga goles o al empezar el siguiente.</p>' : ''}
      <section class="t-tarjeta" aria-labelledby="tTitGoles">
        <div class="t-tarjeta-cab"><h2 id="tTitGoles">Goles por partido</h2>
          <div class="t-leyenda" aria-hidden="true"><span><i class="t-sw favor"></i>A favor</span><span><i class="t-sw contra"></i>En contra</span></div></div>
        ${graficoGoles(D.lista.filter((p) => p.cuenta))}
      </section>
      <section class="t-tarjeta" aria-labelledby="tTitGoleadoras">
        <div class="t-tarjeta-cab"><h2 id="tTitGoleadoras">Goleadoras</h2></div>
        ${graficoGoleadoras(D.jugadoras)}
      </section>
      <section class="t-tarjeta" aria-labelledby="tTitJug">
        <div class="t-tarjeta-cab"><h2 id="tTitJug">Convocatorias y titularidades</h2></div>
        ${tablaJugadoras(D.jugadoras, T.pj)}
      </section>
      <section class="t-tarjeta" aria-labelledby="tTitPart">
        <div class="t-tarjeta-cab"><h2 id="tTitPart">Partidos</h2></div>
        ${listaPartidos(D.lista)}
      </section>`;
    // Si el gráfico no cabe, que se vean primero los partidos más recientes
    const scroll = cuerpo.querySelector('.t-scroll');
    if (scroll) scroll.scrollLeft = scroll.scrollWidth;
  }

  function pintarResumen(T, jugados) {
    const racha = jugados.slice(-5);
    const dif = T.gf - T.gc;
    const pct = (x) => (T.pj ? (x / T.pj) * 100 : 0);
    return `<div class="t-resumen">
      <div class="t-tile t-tile-ancha">
        <span class="t-lab">Resultados</span>
        <span class="t-val">${T.v}<small>V</small> ${T.e}<small>E</small> ${T.d}<small>D</small></span>
        <div class="t-segm" role="img" aria-label="${T.v} victorias, ${T.e} empates y ${T.d} derrotas">
          ${T.v ? `<i class="v" style="flex:${pct(T.v)}"></i>` : ''}${T.e ? `<i class="e" style="flex:${pct(T.e)}"></i>` : ''}${T.d ? `<i class="d" style="flex:${pct(T.d)}"></i>` : ''}
        </div>
        ${racha.length ? `<div class="t-racha" aria-label="Últimos resultados">${racha.map((p) => chipResultado(p)).join('')}</div>` : ''}
      </div>
      <div class="t-tile"><span class="t-lab">Goles a favor</span><span class="t-val">${T.gf}</span><span class="t-sub">${T.pj ? n(T.gf / T.pj) : 0} por partido</span></div>
      <div class="t-tile"><span class="t-lab">Goles en contra</span><span class="t-val">${T.gc}</span><span class="t-sub">${T.pj ? n(T.gc / T.pj) : 0} por partido</span></div>
      <div class="t-tile"><span class="t-lab">Diferencia</span><span class="t-val">${dif > 0 ? '+' : ''}${dif}</span><span class="t-sub">${T.pj} ${T.pj === 1 ? 'partido' : 'partidos'}</span></div>
    </div>`;
  }

  const NOMBRE_RES = { V: 'Victoria', E: 'Empate', D: 'Derrota' };
  const chipResultado = (p, conMarcador = false) => `<span class="t-res ${p.resultado.toLowerCase()}" title="${NOMBRE_RES[p.resultado]} ${p.gf}-${p.gc}${p.rival ? ' contra ' + esc(p.rival) : ''}">${p.resultado}${conMarcador ? ` ${p.gf}-${p.gc}` : ''}</span>`;
  const fechaCorta = (p) => new Date(p.fecha || p.creado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  // Columnas agrupadas: goles a favor y en contra por partido
  function graficoGoles(partidos) {
    if (!partidos.length) return '<p class="nota">Sin partidos jugados todavía.</p>';
    const max = Math.max(1, ...partidos.map((p) => Math.max(p.gf, p.gc)));
    const paso = max <= 5 ? 1 : max <= 10 ? 2 : 5;
    const tope = Math.ceil(max / paso) * paso;
    const izq = 28; const alto = 160; const arriba = 18; const abajo = 34;
    // Ocupa el ancho de la tarjeta; con muchos partidos, cada uno mínimo 64 px y se desplaza en horizontal
    const disponible = Math.max(280, cuerpo.clientWidth - 30);
    const banda = Math.max(64, Math.floor((disponible - izq - 8) / partidos.length));
    const barra = Math.min(20, Math.floor((banda - 16) / 2)); const hueco = 2;
    const ancho = izq + partidos.length * banda + 8;
    const caben = Math.max(6, Math.floor((banda - 6) / 6.4));
    const rivalCorto = (p, i) => {
      const r = (p.rival || `Partido ${i + 1}`).split(/[,·(]/)[0].trim();
      return esc(r.length > caben ? `${r.slice(0, caben - 1)}…` : r);
    };
    const y = (v) => arriba + alto - (v / tope) * alto;
    const marcas = [];
    for (let v = 0; v <= tope; v += paso) marcas.push(v);
    const columna = (x, v, clase, texto) => {
      if (!v) return '';
      const h = (v / tope) * alto; const r = Math.min(4, h);
      return `<path class="${clase}" d="M${x},${arriba + alto} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barra - r} Q${x + barra},${y(v)} ${x + barra},${y(v) + r} V${arriba + alto} Z" data-tip="${esc(texto)}"/>`;
    };
    let s = `<svg class="t-svg" viewBox="0 0 ${ancho} ${arriba + alto + abajo}" width="${ancho}" height="${arriba + alto + abajo}" role="img" aria-label="Goles a favor y en contra en cada partido">`;
    marcas.forEach((v) => { s += `<line class="t-grid" x1="${izq}" x2="${ancho - 4}" y1="${y(v)}" y2="${y(v)}"/><text class="t-eje" x="${izq - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
    partidos.forEach((p, i) => {
      const x0 = izq + i * banda + (banda - (barra * 2 + hueco)) / 2;
      const nombre = p.rival || `Partido ${i + 1}`;
      s += `<rect class="t-hit" x="${izq + i * banda}" y="${arriba}" width="${banda}" height="${alto}" data-tip="${esc(`${nombre} · ${fechaCorta(p)}: ${p.gf}-${p.gc} (${NOMBRE_RES[p.resultado]})`)}"/>`;
      s += columna(x0, p.gf, 'favor', `${nombre}: ${p.gf} a favor`);
      s += columna(x0 + barra + hueco, p.gc, 'contra', `${nombre}: ${p.gc} en contra`);
      s += `<text class="t-eje" x="${izq + i * banda + banda / 2}" y="${arriba + alto + 15}" text-anchor="middle">${rivalCorto(p, i)}</text>`;
      s += `<text class="t-eje t-eje-sub" x="${izq + i * banda + banda / 2}" y="${arriba + alto + 28}" text-anchor="middle">${fechaCorta(p)}</text>`;
    });
    s += `<line class="t-base" x1="${izq}" x2="${ancho - 4}" y1="${arriba + alto}" y2="${arriba + alto}"/></svg>`;
    return `<div class="t-scroll">${s}</div>`;
  }

  // Barras horizontales: goles por jugadora
  function graficoGoleadoras(jugadoras) {
    const top = jugadoras.filter((j) => j.goles > 0).sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre, 'es')).slice(0, 10);
    if (!top.length) return '<p class="nota">Todavía no hay goles con jugadora asignada.</p>';
    const max = Math.max(...top.map((j) => j.goles));
    return `<ol class="t-barras">${top.map((j) => `
      <li data-tip="${esc(`${j.nombre}: ${j.goles} ${j.goles === 1 ? 'gol' : 'goles'} en ${j.conv} ${j.conv === 1 ? 'partido' : 'partidos'}`)}">
        <span class="t-quien">${j.dorsal ? `<b>${esc(j.dorsal)}</b>` : ''}${esc(j.nombre)}</span>
        <span class="t-pista"><i style="width:${(j.goles / max) * 100}%"></i></span>
        <span class="t-num">${j.goles}</span>
      </li>`).join('')}</ol>`;
  }

  // Tabla: convocatorias (con medidor), titularidades y goles. Columnas ordenables.
  function tablaJugadoras(jugadoras, pj) {
    if (!jugadoras.length) return '<p class="nota">Sin jugadoras.</p>';
    const { campo, desc } = E.orden;
    const valor = { nombre: (j) => j.nombre.toLowerCase(), dorsal: (j) => parseInt(j.dorsal, 10) || 999, conv: (j) => j.conv, tit: (j) => j.tit, goles: (j) => j.goles, seg: (j) => j.seg, tarj: (j) => j.ro * 10 + j.am };
    // Minutos y tarjetas solo aparecen cuando ya se han apuntado (los partidos antiguos no los tienen)
    const conMin = jugadoras.some((j) => j.seg > 0);
    const conTarj = jugadoras.some((j) => j.am || j.ro);
    const lista = [...jugadoras].sort((a, b) => {
      const va = valor[campo](a); const vb = valor[campo](b);
      return (va > vb ? 1 : va < vb ? -1 : 0) * (desc ? -1 : 1) || a.nombre.localeCompare(b.nombre, 'es');
    });
    const th = (c, texto, clase = '') => `<th class="${clase}" aria-sort="${campo === c ? (desc ? 'descending' : 'ascending') : 'none'}"><button data-orden="${c}">${texto}${campo === c ? (desc ? ' ↓' : ' ↑') : ''}</button></th>`;
    return `<div class="t-tabla-cont"><table class="t-tabla">
      <thead><tr>${th('dorsal', 'Nº', 'num')}${th('nombre', 'Jugadora')}${th('conv', 'Convocada')}${th('tit', 'Titular', 'num')}${conMin ? th('seg', 'Min.', 'num') : ''}${th('goles', 'Goles', 'num')}${conTarj ? th('tarj', 'Tarj.', 'num') : ''}</tr></thead>
      <tbody>${lista.map((j) => {
        const pct = pj ? Math.round((j.conv / pj) * 100) : 0;
        const pctTit = j.conv ? Math.round((j.tit / j.conv) * 100) : 0;
        return `<tr${j.activa ? '' : ' class="baja"'}>
          <td class="num">${esc(j.dorsal || '–')}</td>
          <td>${esc(j.nombre)}${j.activa ? '' : ' <small>(baja)</small>'}</td>
          <td><div class="t-conv" data-tip="${esc(`${j.nombre}: convocada en ${j.conv} de ${pj} partidos (${pct}%)`)}">
            <span class="t-medidor" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="num">${j.conv}/${pj}</span></div></td>
          <td class="num" data-tip="${esc(`${j.nombre}: titular en ${j.tit} de ${j.conv} convocatorias (${pctTit}%)`)}">${j.tit}</td>
          ${conMin ? `<td class="num" data-tip="${esc(`${j.nombre}: ${Math.round(j.seg / 60)} minutos en el campo${j.conv ? ` (${Math.round(j.seg / 60 / j.conv)} de media por convocatoria)` : ''}`)}">${Math.round(j.seg / 60)}</td>` : ''}
          <td class="num"><strong>${j.goles}</strong></td>
          ${conTarj ? `<td class="num t-tarj">${j.am ? `🟨${j.am > 1 ? j.am : ''}` : ''}${j.ro ? `🟥${j.ro > 1 ? j.ro : ''}` : ''}</td>` : ''}</tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // Lista de partidos, del más reciente al más antiguo, con detalle desplegable
  function listaPartidos(partidos) {
    const F = E.datos.fichaPorId;
    const nombre = (id) => F[id]?.jugadoras?.nombre || 'Sin nombre';
    const dorsalEn = (p, id) => F[id]?.dorsal || '';
    return `<ul class="t-partidos">${[...partidos].reverse().map((p) => {
      const goles = Object.entries(p.goleadoras).map(([id, g]) => `${id === '_' ? 'Sin asignar' : esc(nombre(id))}${g > 1 ? ` (${g})` : ''}`).join(', ');
      const jug = p.co.filter((c) => F[c.ficha_id]?.tipo !== 'staff');
      const tit = jug.filter((c) => c.titular); const sup = jug.filter((c) => !c.titular);
      const staff = p.co.filter((c) => F[c.ficha_id]?.tipo === 'staff');
      const abierto = E.abiertos.has(p.id);
      const chip = (c) => `<span class="t-persona">${dorsalEn(p, c.ficha_id) ? `<b>${esc(dorsalEn(p, c.ficha_id))}</b>` : ''}${esc(nombre(c.ficha_id))}${c.segundos_jugados ? `<small>${Math.round(c.segundos_jugados / 60)}'</small>` : ''}</span>`;
      const textoEv = (e) => {
        if (e.tipo === 'gol_rival') return `⚽ ${esc(p.rival || 'Rival')}`;
        if (e.tipo === 'gol') return `⚽ ${esc(e.ficha_id ? nombre(e.ficha_id) : 'Gol nuestro')}`;
        if (e.tipo === 'cambio') return `🔄 Entra ${esc(e.ficha_entra ? nombre(e.ficha_entra) : '—')}${e.ficha_id ? ` · sale ${esc(nombre(e.ficha_id))}` : ''}`;
        return `${e.tipo === 'roja' ? '🟥' : '🟨'} ${esc(e.ficha_id ? nombre(e.ficha_id) : '—')}`;
      };
      const claseEv = (e) => (e.tipo === 'gol' ? 'favor' : e.tipo === 'gol_rival' ? 'contra' : 'otro');
      return `<li class="t-partido${abierto ? ' abierto' : ''}">
        <button class="t-partido-cab" data-partido="${p.id}" aria-expanded="${abierto}">
          <span class="t-fecha">${fechaCorta(p)}</span>
          <span class="t-rival">${esc(p.rival || 'Rival sin nombre')}${p.esActual ? ' <em>actual</em>' : ''}<small>${goles ? `⚽ ${goles}` : 'Sin goles nuestros'}</small></span>
          ${p.cuenta ? chipResultado(p, true) : '<span class="t-res pend">En curso</span>'}
        </button>
        ${abierto ? `<div class="t-partido-det">
          ${tit.length ? `<h3>Titulares · ${tit.length}</h3><div class="t-personas">${tit.map(chip).join('')}</div>` : ''}
          ${sup.length ? `<h3>${tit.length ? 'Suplentes' : 'Convocadas'} · ${sup.length}</h3><div class="t-personas">${sup.map(chip).join('')}</div>` : ''}
          ${staff.length ? `<h3>Cuerpo técnico · ${staff.length}</h3><div class="t-personas">${staff.map(chip).join('')}</div>` : ''}
          ${p.ev.length ? `<h3>${p.ev.some((e) => e.tipo !== 'gol' && e.tipo !== 'gol_rival') ? 'Lo que pasó' : 'Goles'}</h3><ol class="t-goles">${[...p.ev].sort((a, b) => a.parte - b.parte || (a.segundo ?? a.minuto * 60) - (b.segundo ?? b.minuto * 60)).map((e) => `<li class="${claseEv(e)}"><span>${e.minuto ?? '–'}' · ${e.parte}ª</span>${textoEv(e)}</li>`).join('')}</ol>` : ''}
        </div>` : ''}
      </li>`;
    }).join('')}</ul>`;
  }

  // ---------------------------------------------------------------- Interacción
  cuerpo.addEventListener('click', (e) => {
    if (e.target.closest('#tRecargar')) { cargar(); return; }
    const orden = e.target.closest('[data-orden]');
    if (orden) {
      const c = orden.dataset.orden;
      E.orden = { campo: c, desc: E.orden.campo === c ? !E.orden.desc : c !== 'nombre' && c !== 'dorsal' };
      pintar();
      return;
    }
    const partido = e.target.closest('[data-partido]');
    if (partido) {
      const id = partido.dataset.partido;
      if (E.abiertos.has(id)) E.abiertos.delete(id); else E.abiertos.add(id);
      pintar();
      return;
    }
    const conTip = e.target.closest('[data-tip]');
    if (conTip) mostrarTip(conTip, e); else tip.hidden = true;
  });
  function mostrarTip(el, e) {
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const x = Math.min(Math.max(8, e.clientX - tip.offsetWidth / 2), window.innerWidth - tip.offsetWidth - 8);
    const y = e.clientY - tip.offsetHeight - 14;
    tip.style.left = `${x}px`;
    tip.style.top = `${y < 8 ? e.clientY + 18 : y}px`;
  }
  cuerpo.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-tip]');
    if (el) mostrarTip(el, e); else tip.hidden = true;
  });
  cuerpo.addEventListener('pointerleave', () => { tip.hidden = true; });
  document.addEventListener('scroll', () => { tip.hidden = true; }, true);

  return { cargar };
}
