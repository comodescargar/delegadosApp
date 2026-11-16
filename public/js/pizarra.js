'use strict';
/*
 * Pizarra táctica — prototipo.
 * Las posiciones se guardan normalizadas (x 0..1 izquierda→derecha, y 0..1 desde la portería
 * atacada (arriba) hasta la propia (abajo)), así una jugada sirve para cualquier tamaño de pantalla.
 */

// ------------------------------------------------------------------ Configuración
const CAMPOS = {
  f11: { nombre: 'Fútbol 11', W: 68, L: 105, r: 2.0, franjas: 12 },
  f7: { nombre: 'Fútbol 7', W: 40, L: 60, r: 1.4, franjas: 10 },
  sala: { nombre: 'Fútbol sala', W: 20, L: 40, r: 0.85, franjas: 0 },
};
const COLOR = {
  local: '#2563eb', localPor: '#f59e0b', rival: '#dc2626', rivalPor: '#27272a',
  pase: '#ffffff', mov: '#fde047', movRival: '#fca5a5', tiro: '#fb923c',
};
const BIB = window.BIBLIOTECA;
const CLAVE_MIAS = 'pizarra.misJugadas';

// ------------------------------------------------------------------ Utilidades
const $ = (s) => document.querySelector(s);
const n = (v) => Math.round(v * 100) / 100;
const clonar = (o) => JSON.parse(JSON.stringify(o));
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('visible'), 2600);
}

// ------------------------------------------------------------------ Estado
const E = {
  doc: null, paso: 0, herramienta: 'mover', sel: null,
  arrastre: null, trazo: null, anim: null, velocidad: 1, verPuestos: false,
};

const pasoVacio = (pos) => ({ pos, texto: '', estilos: {}, lineas: [], zonas: [] });
const docVacio = (mod) => ({
  titulo: 'Nueva pizarra', mod, vista: 'completo', categoria: '', nivel: '', descripcion: '',
  elementos: {}, pasos: [pasoVacio({})],
});

function infoDesdeId(id) {
  let m;
  if ((m = id.match(/^a(\d+)$/))) return { tipo: 'jugador', equipo: 'local', etiqueta: m[1], portero: m[1] === '1' };
  if ((m = id.match(/^r(\d+)$/))) return { tipo: 'jugador', equipo: 'rival', etiqueta: '', portero: m[1] === '1' };
  if (/^b\d*$/.test(id)) return { tipo: 'balon' };
  if (/^k\d*$/.test(id)) return { tipo: 'cono' };
  throw new Error('Identificador no válido: ' + id);
}

/** Convierte una jugada de la biblioteca (en metros) al formato de la pizarra. */
function docDesdeJugada(j) {
  const c = CAMPOS[j.mod];
  const N = (p) => [0.5 + p[0] / c.W, p[1] / c.L];
  const rect = (z) => ({ a: N([z[0], z[1]]), b: N([z[2], z[3]]) });
  const elementos = {};
  const pos = {};
  for (const [id, p] of Object.entries(j.el)) { elementos[id] = infoDesdeId(id); pos[id] = N(p); }
  const zonas = (j.zonas || []).map(rect);
  const pasos = [pasoVacio(pos)];
  j.pasos.forEach(([texto, movs, estilos], i) => {
    const actual = pasos[i];
    actual.texto = texto;
    actual.estilos = { ...(estilos || {}) };
    const sig = { ...actual.pos };
    for (const [id, p] of Object.entries(movs || {})) {
      if (!elementos[id]) console.warn(`Jugada ${j.id}: elemento desconocido ${id}`);
      else sig[id] = N(p);
    }
    pasos.push(pasoVacio(sig));
  });
  pasos[pasos.length - 1].texto = j.fin || 'Fin de la jugada.';
  pasos.forEach((p) => { p.zonas = clonar(zonas); });
  return {
    titulo: j.titulo, mod: j.mod, vista: j.vista || 'completo', encuadre: j.encuadre ? rect(j.encuadre) : null,
    categoria: j.cat, nivel: j.nivel || '', descripcion: j.desc || '', origen: j.id, elementos, pasos: clonar(pasos),
  };
}

/** Coloca un sistema (y opcionalmente el del rival, en espejo). */
function docDesdeSistema(s, rival) {
  const elementos = {};
  const pos = {};
  s.j.forEach(([d, x, y, puesto]) => {
    elementos['a' + d] = { tipo: 'jugador', equipo: 'local', etiqueta: String(d), portero: puesto.startsWith('POR'), puesto };
    pos['a' + d] = [x, y];
  });
  if (rival) {
    rival.j.forEach(([d, x, y, puesto]) => {
      elementos['r' + d] = { tipo: 'jugador', equipo: 'rival', etiqueta: '', portero: puesto.startsWith('POR'), puesto };
      pos['r' + d] = [1 - x, 1 - y];
    });
  }
  elementos.b = { tipo: 'balon' };
  pos.b = [0.5, 0.5];
  return {
    titulo: rival ? `${s.nombre} contra ${rival.nombre}` : `Sistema ${s.nombre}`, mod: s.mod, vista: 'completo',
    categoria: 'sistema', nivel: '', descripcion: s.desc, origen: s.id, elementos, pasos: [pasoVacio(pos)],
  };
}

/**
 * Alineación del partido: coloca a las jugadoras en un sistema de su modalidad.
 * datos = { titulo, mod?, enCampo: [{ dorsal, nombre }], banquillo: [{ dorsal, nombre }] }
 * La portera es la del dorsal 1 o 13 (si no hay, la primera); el resto, por dorsal, en el orden del sistema.
 */
const MOD_POR_NUMERO = { 5: 'sala', 7: 'f7', 11: 'f11' };
const nombreCorto = (t) => { const p = String(t || '').trim().split(/\s+/)[0] || ''; return p.length > 10 ? p.slice(0, 9) + '.' : p; };
function docAlineacion(datos, sistemaId) {
  const mod = CAMPOS[datos.mod] ? datos.mod : (MOD_POR_NUMERO[datos.enCampo.length] || E.doc?.mod || 'f7');
  const sistemas = BIB.sistemas.filter((s) => s.mod === mod);
  const s = sistemas.find((x) => x.id === sistemaId) || sistemas[0];
  const slots = [...s.j].sort((a, b) => b[3].startsWith('POR') - a[3].startsWith('POR'));
  const jug = [...datos.enCampo];
  let iPor = jug.findIndex((j) => ['1', '13'].includes(String(j.dorsal)));
  if (iPor < 0) iPor = 0;
  const ordenadas = jug.length ? [jug[iPor], ...jug.filter((_, i) => i !== iPor)] : [];
  const fuera = ordenadas.slice(slots.length);
  const elementos = {};
  const pos = {};
  ordenadas.slice(0, slots.length).forEach((j, i) => {
    const [, x, y, puesto] = slots[i];
    elementos['a' + (i + 1)] = { tipo: 'jugador', equipo: 'local', etiqueta: String(j.dorsal || '').slice(0, 3), portero: puesto.startsWith('POR'), puesto: nombreCorto(j.nombre) || puesto };
    pos['a' + (i + 1)] = [x, y];
  });
  elementos.b = { tipo: 'balon' };
  pos.b = [0.5, 0.5];
  const banquillo = [...fuera, ...(datos.banquillo || [])];
  const nombre = (j) => [j.dorsal, j.nombre].filter(Boolean).join(' ');
  const huecos = slots.length - Math.min(slots.length, ordenadas.length);
  const texto = [`Sistema ${s.nombre}.`, huecos ? `Faltan ${huecos} en el campo.` : '',
    banquillo.length ? `Banquillo: ${banquillo.map(nombre).join(', ')}.` : ''].filter(Boolean).join(' ');
  const p = pasoVacio(pos);
  p.texto = texto;
  return {
    titulo: datos.titulo || 'Alineación', mod, vista: 'completo', categoria: 'sistema', nivel: '',
    descripcion: `Alineación en ${s.nombre}. Arrastra las fichas para recolocarlas; puedes guardarla en «Mis jugadas».`,
    origen: s.id, elementos, pasos: [p], alineacion: { datos, sistema: s.id },
  };
}

// Para Fichas y Partido (fichas.js): abre la pizarra con la alineación
window.Pizarra = {
  usarNube(api) { NUBE = api; B.club = null; },
  alineacion(datos) {
    cargarDoc(docAlineacion(datos));
    E.verPuestos = true;
    $('#chkPuestos').checked = true;
    render();
    window.mostrarSeccion?.('pizarra');
    window.scrollTo(0, 0);
  },
};

// ------------------------------------------------------------------ Geometría
function cajaVista(doc) {
  const { W, L } = CAMPOS[doc.mod];
  const m = W * 0.06;
  if (doc.vista === 'ataque') return [-m, -m, W + 2 * m, L * 0.5 + m * 1.5];
  if (doc.vista === 'defensa') return [-m, L * 0.5 - m * 0.5, W + 2 * m, L * 0.5 + m * 1.5];
  if (doc.vista === 'encuadre' && doc.encuadre) {
    const { a, b } = doc.encuadre;
    const x = Math.min(a[0], b[0]) * W; const y = Math.min(a[1], b[1]) * L;
    return [x, y, Math.abs(b[0] - a[0]) * W, Math.abs(b[1] - a[1]) * L];
  }
  return [-m, -m, W + 2 * m, L + 2 * m];
}

/** Escala de fichas y líneas: en vistas ampliadas (zona de ejercicio) se reducen. */
function escala(doc) {
  const c = CAMPOS[doc.mod];
  return Math.min(1, Math.max(0.5, Math.pow(cajaVista(doc)[2] / (c.W * 1.12), 0.7)));
}

const aMetros = (doc, p) => [p[0] * CAMPOS[doc.mod].W, p[1] * CAMPOS[doc.mod].L];
function distM(doc, p, q) {
  const c = CAMPOS[doc.mod];
  return Math.hypot((p[0] - q[0]) * c.W, (p[1] - q[1]) * c.L);
}

/** Calcula los movimientos del paso i al i+1 y su tipo de flecha. */
function movimientos(doc, i) {
  const A = doc.pasos[i]?.pos; const B = doc.pasos[i + 1]?.pos;
  if (!A || !B) return [];
  const c = CAMPOS[doc.mod];
  const estilos = doc.pasos[i].estilos || {};
  const ids = Object.keys(doc.elementos).filter((id) => A[id] && B[id] && distM(doc, A[id], B[id]) > 0.05);
  const conductores = new Set(); const conducidos = new Set();
  for (const b of ids.filter((id) => doc.elementos[id].tipo === 'balon')) {
    if (estilos[b]) continue; // golpeo indicado expresamente: nunca es conducción
    for (const p of ids) {
      if (doc.elementos[p].tipo !== 'jugador' || conductores.has(p)) continue;
      if (distM(doc, A[p], A[b]) < c.r * 1.7 && distM(doc, B[p], B[b]) < c.r * 1.3) {
        conductores.add(p); conducidos.add(b); break;
      }
    }
  }
  return ids.filter((id) => !conducidos.has(id)).map((id) => {
    const el = doc.elementos[id];
    let tipo = 'movimiento';
    if (el.tipo === 'balon') tipo = estilos[id] || 'pase';
    else if (conductores.has(id)) tipo = 'conduccion';
    return { id, tipo, equipo: el.equipo, a: A[id], b: B[id] };
  });
}

/** Punto de control de la curva de un centro: se curva hacia el centro del campo. */
function controlCurva(a, b, W, L) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len; let ny = dx / len;
  const mx = (a[0] + b[0]) / 2; const my = (a[1] + b[1]) / 2;
  if (nx * (W / 2 - mx) + ny * (L / 2 - my) < 0) { nx = -nx; ny = -ny; }
  return [mx + nx * len * 0.22, my + ny * len * 0.22];
}
const bezier = (a, c, b, t) => [
  (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
];

// ------------------------------------------------------------------ Dibujo del campo
function svgCampo(mod) {
  const { W, L, franjas } = CAMPOS[mod];
  const cx = W / 2;
  const lw = mod === 'sala' ? 0.09 : W * 0.0045;
  const m = W * 0.06;
  let s = `<rect x="${-m}" y="${-m}" width="${W + 2 * m}" height="${L + 2 * m}" fill="${mod === 'sala' ? '#16324f' : '#25602b'}"/>`;
  if (franjas) {
    for (let i = 0; i < franjas; i++) s += `<rect x="0" y="${n((i * L) / franjas)}" width="${W}" height="${n(L / franjas)}" fill="${i % 2 ? '#3d9145' : '#378840'}"/>`;
  } else {
    s += `<rect x="0" y="0" width="${W}" height="${L}" fill="#2f6fae"/>`;
  }
  const rc = { f11: 9.15, f7: 6, sala: 3 }[mod];
  let ext = '';
  if (mod === 'f11') {
    const dx = Math.sqrt(9.15 ** 2 - 5.5 ** 2);
    ext += `<rect x="${n(cx - 20.16)}" y="0" width="40.32" height="16.5"/>`;
    ext += `<rect x="${n(cx - 9.16)}" y="0" width="18.32" height="5.5"/>`;
    ext += `<circle cx="${cx}" cy="11" r="${lw * 1.3}" fill="#fff"/>`;
    ext += `<path d="M${n(cx - dx)} 16.5 A9.15 9.15 0 0 0 ${n(cx + dx)} 16.5"/>`;
    ext += `<rect x="${n(cx - 3.66)}" y="-2" width="7.32" height="2" fill="rgba(255,255,255,.22)"/>`;
    ext += `<path d="M1 0 A1 1 0 0 1 0 1"/><path d="M${W - 1} 0 A1 1 0 0 0 ${W} 1"/>`;
  } else if (mod === 'f7') {
    ext += `<rect x="${cx - 13}" y="0" width="26" height="13"/>`;
    ext += `<rect x="${cx - 6}" y="0" width="12" height="5"/>`;
    ext += `<circle cx="${cx}" cy="9" r="${lw * 1.3}" fill="#fff"/>`;
    ext += `<rect x="${cx - 3}" y="-1.5" width="6" height="1.5" fill="rgba(255,255,255,.22)"/>`;
    ext += `<path d="M0.8 0 A0.8 0.8 0 0 1 0 0.8"/><path d="M${W - 0.8} 0 A0.8 0.8 0 0 0 ${W} 0.8"/>`;
  } else {
    ext += `<path d="M${cx - 7.5} 0 A6 6 0 0 0 ${cx - 1.5} 6 L${cx + 1.5} 6 A6 6 0 0 0 ${cx + 7.5} 0" fill="#2a64a0"/>`;
    ext += `<circle cx="${cx}" cy="6" r="${lw * 1.6}" fill="#fff"/>`;
    ext += `<circle cx="${cx}" cy="10" r="${lw * 1.6}" fill="#fff"/>`;
    ext += `<rect x="${cx - 1.5}" y="-1" width="3" height="1" fill="rgba(255,255,255,.22)"/>`;
    ext += `<path d="M0.3 0 A0.3 0.3 0 0 1 0 0.3"/><path d="M${W - 0.3} 0 A0.3 0.3 0 0 0 ${W} 0.3"/>`;
  }
  s += `<g fill="none" stroke="#fff" stroke-width="${n(lw)}" stroke-opacity=".92">`;
  s += `<rect x="0" y="0" width="${W}" height="${L}"/>`;
  s += `<line x1="0" y1="${L / 2}" x2="${W}" y2="${L / 2}"/>`;
  s += `<circle cx="${cx}" cy="${L / 2}" r="${rc}"/>`;
  s += `<circle cx="${cx}" cy="${L / 2}" r="${lw * 1.3}" fill="#fff"/>`;
  s += `<g>${ext}</g><g transform="translate(0 ${L}) scale(1 -1)">${ext}</g>`;
  s += '</g>';
  return s;
}

// ------------------------------------------------------------------ Dibujo de flechas y elementos
function ondulada(a, b, amp, lam) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return '';
  const ux = dx / len; const uy = dy / len; const nx = -uy; const ny = ux;
  const recto = Math.min(len * 0.25, lam);
  const ondaLen = len - recto;
  const k = Math.max(1, Math.round(ondaLen / lam));
  const l = ondaLen / k;
  const pasos = k * 12;
  let d = `M${n(a[0])} ${n(a[1])}`;
  for (let i = 1; i <= pasos; i++) {
    const t = (i / pasos) * ondaLen;
    const off = Math.sin((t / l) * 2 * Math.PI) * amp;
    d += ` L${n(a[0] + ux * t + nx * off)} ${n(a[1] + uy * t + ny * off)}`;
  }
  return d + ` L${n(b[0])} ${n(b[1])}`;
}

function recortar(a, b, ini, fin) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len <= ini + fin + 0.1) return [a, b];
  const ux = dx / len; const uy = dy / len;
  return [[a[0] + ux * ini, a[1] + uy * ini], [b[0] - ux * fin, b[1] - uy * fin]];
}

function svgFlecha(doc, f, opc = {}) {
  const c = CAMPOS[doc.mod];
  const k = escala(doc);
  const sw = c.W * 0.0065 * k;
  let a = aMetros(doc, f.a); let b = aMetros(doc, f.b);
  [a, b] = recortar(a, b, opc.ini || 0, opc.fin || 0);
  let color = COLOR.pase; let marca = 'm-blanco'; let extra = ''; let ancho = sw;
  if (f.tipo === 'movimiento') {
    color = f.equipo === 'rival' ? COLOR.movRival : COLOR.mov;
    marca = f.equipo === 'rival' ? 'm-rojo' : 'm-amarillo';
    extra = ` stroke-dasharray="${n(sw * 2.6)} ${n(sw * 1.8)}"`;
  } else if (f.tipo === 'tiro') {
    color = COLOR.tiro; marca = 'm-naranja'; ancho = sw * 1.6;
  }
  const attrs = `fill="none" stroke="${color}" stroke-width="${n(ancho)}" stroke-linecap="round" marker-end="url(#${marca})"${extra}${opc.datos || ''}`;
  if (f.tipo === 'conduccion') return `<path d="${ondulada(a, b, c.r * k * 0.32, c.r * k * 1.5)}" ${attrs}/>`;
  if (f.tipo === 'centro') {
    const q = controlCurva(a, b, c.W, c.L);
    return `<path d="M${n(a[0])} ${n(a[1])} Q${n(q[0])} ${n(q[1])} ${n(b[0])} ${n(b[1])}" ${attrs}/>`;
  }
  return `<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" ${attrs}/>`;
}

function svgElemento(doc, id, p, opc) {
  const el = doc.elementos[id];
  const r = CAMPOS[doc.mod].r * escala(doc);
  const [x, y] = aMetros(doc, p);
  let s = `<g data-id="${id}" class="el">`;
  if (el.tipo === 'balon') {
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 1.1)}" fill="transparent"/>`;
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.52)}" fill="#fff" stroke="#111" stroke-width="${n(r * 0.1)}"/>`;
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.2)}" fill="#111"/>`;
  } else if (el.tipo === 'cono') {
    const t = r * 0.75;
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="transparent"/>`;
    s += `<polygon points="${n(x)},${n(y - t)} ${n(x + t * 0.9)},${n(y + t * 0.6)} ${n(x - t * 0.9)},${n(y + t * 0.6)}" fill="#f97316" stroke="#7c2d12" stroke-width="${n(r * 0.08)}"/>`;
  } else {
    const local = el.equipo === 'local';
    const fill = el.portero ? (local ? COLOR.localPor : COLOR.rivalPor) : (local ? COLOR.local : COLOR.rival);
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}" stroke="#fff" stroke-width="${n(r * 0.14)}"/>`;
    if (el.etiqueta) {
      const fs = el.etiqueta.length > 1 ? r * 0.95 : r * 1.1;
      s += `<text x="${n(x)}" y="${n(y)}" font-size="${n(fs)}" font-weight="700" fill="${el.portero && local ? '#111' : '#fff'}" text-anchor="middle" dominant-baseline="central">${esc(el.etiqueta)}</text>`;
    }
    if (opc.puestos && el.puesto) {
      s += `<text x="${n(x)}" y="${n(y + r * 1.75)}" font-size="${n(r * 0.75)}" font-weight="600" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="${n(r * 0.18)}" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(el.puesto)}</text>`;
    }
  }
  if (opc.sel === id) {
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 1.5)}" fill="none" stroke="#fde047" stroke-width="${n(r * 0.12)}" stroke-dasharray="${n(r * 0.4)} ${n(r * 0.25)}"/>`;
  }
  return s + '</g>';
}

/** Escena de un paso: zonas, líneas, flechas automáticas y elementos. */
function svgEscena(doc, i, opc = {}) {
  const paso = doc.pasos[i];
  const pos = opc.pos || paso.pos;
  const c = { ...CAMPOS[doc.mod] };
  c.r *= escala(doc);
  c.W *= escala(doc);
  let s = '';
  paso.zonas.forEach((z, k) => {
    const [x1, y1] = aMetros(doc, z.a); const [x2, y2] = aMetros(doc, z.b);
    s += `<rect data-zona="${k}" x="${n(Math.min(x1, x2))}" y="${n(Math.min(y1, y2))}" width="${n(Math.abs(x2 - x1))}" height="${n(Math.abs(y2 - y1))}" fill="rgba(253,224,71,.16)" stroke="#fde047" stroke-width="${n(c.W * 0.004)}" stroke-dasharray="${n(c.r * 0.6)} ${n(c.r * 0.4)}"/>`;
  });
  paso.lineas.forEach((l, k) => { s += svgFlecha(doc, l, { datos: ` data-linea="${k}"` }); });
  if (opc.flechas !== false) {
    const sig = doc.pasos[i + 1]?.pos || {};
    s += `<g pointer-events="none" opacity="${opc.opacidadFlechas ?? 1}">`;
    for (const f of movimientos(doc, i)) {
      const el = doc.elementos[f.id];
      let ini = el.tipo === 'jugador' ? c.r * 1.05 : c.r * 0.55;
      let fin = 0;
      if (el.tipo === 'balon' && f.tipo !== 'tiro') {
        const ocupado = Object.keys(sig).some((id) => id !== f.id && doc.elementos[id]?.tipo === 'jugador' && distM(doc, sig[id], f.b) < c.r * 1.3);
        fin = ocupado ? c.r * 1.1 : c.r * 0.5;
      }
      if (f.tipo === 'conduccion') ini = c.r * 1.05;
      s += svgFlecha(doc, f, { ini, fin });
    }
    s += '</g>';
  }
  const orden = { cono: 0, jugador: 1, balon: 2 };
  Object.keys(doc.elementos)
    .filter((id) => pos[id])
    .sort((a, b) => orden[doc.elementos[a].tipo] - orden[doc.elementos[b].tipo])
    .forEach((id) => { s += svgElemento(doc, id, pos[id], opc); });
  if (opc.trazo) {
    const t = opc.trazo;
    if (t.tipo === 'zona') s += svgEscena.zonaTemporal(doc, t);
    else s += svgFlecha(doc, { tipo: t.tipo, a: t.a, b: t.b, equipo: 'local' });
  }
  return s;
}
svgEscena.zonaTemporal = (doc, t) => {
  const [x1, y1] = aMetros(doc, t.a); const [x2, y2] = aMetros(doc, t.b);
  return `<rect x="${n(Math.min(x1, x2))}" y="${n(Math.min(y1, y2))}" width="${n(Math.abs(x2 - x1))}" height="${n(Math.abs(y2 - y1))}" fill="rgba(253,224,71,.16)" stroke="#fde047" stroke-width="0.2"/>`;
};

function svgCompleto(doc, i, opc = {}) {
  const vb = cajaVista(doc).map(n).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" font-family="system-ui, sans-serif"${opc.attrs || ''}>${opc.defs ? $('#defs').outerHTML : ''}${svgCampo(doc.mod)}${svgEscena(doc, i, opc)}</svg>`;
}

// ------------------------------------------------------------------ Render principal
const lienzo = $('#lienzo');
let campoDibujado = '';

function render(opc = {}) {
  const doc = E.doc;
  const clave = doc.mod;
  if (campoDibujado !== clave) { $('#campo').innerHTML = svgCampo(doc.mod); campoDibujado = clave; }
  const vb = cajaVista(doc).map(n);
  lienzo.setAttribute('viewBox', vb.join(' '));
  lienzo.style.setProperty('--ar', `${vb[2]} / ${vb[3]}`);
  const rec = $('#recorteRect');
  rec.setAttribute('x', vb[0]); rec.setAttribute('y', vb[1]);
  rec.setAttribute('width', vb[2]); rec.setAttribute('height', vb[3]);
  $('#capa').innerHTML = svgEscena(doc, opc.paso ?? E.paso, {
    pos: opc.pos, sel: E.anim ? null : E.sel, trazo: E.trazo, puestos: E.verPuestos,
    opacidadFlechas: opc.opacidadFlechas,
  });
}

function actualizarUI() {
  const doc = E.doc;
  const total = doc.pasos.length;
  $('#indicador').textContent = `Paso ${E.paso + 1} / ${total}`;
  $('#btnAnterior').disabled = E.paso === 0;
  $('#btnSiguiente').disabled = E.paso >= total - 1;
  $('#btnBorrarPaso').disabled = total <= 1;
  $('#btnPlay').textContent = E.anim ? '⏸ Pausa' : '▶ Reproducir';
  $('#textoPaso').value = doc.pasos[E.paso].texto || '';
  $('#titulo').value = doc.titulo;
  $('#selMod').value = doc.mod;
  const optEnc = $('#selVista option[value="encuadre"]');
  optEnc.hidden = !doc.encuadre;
  $('#selVista').value = doc.vista === 'encuadre' && !doc.encuadre ? 'completo' : doc.vista;
  $('#infoCategoria').textContent = doc.categoria === 'sistema' ? 'Sistema' : (BIB.categorias[doc.categoria] || 'Pizarra libre');
  $('#infoNivel').textContent = doc.nivel || '';
  $('#infoNivel').hidden = !doc.nivel;
  $('#infoModalidad').textContent = CAMPOS[doc.mod].nombre;
  $('#descripcion').value = doc.descripcion || '';
  actualizarProps();
}

function actualizarProps() {
  const cont = $('#props');
  const id = E.sel;
  const el = id && E.doc.elementos[id];
  if (!el) {
    const ayudas = {
      mover: 'Toca una ficha para seleccionarla y arrástrala para moverla. Para animar una jugada: pulsa «+ Paso» y mueve las fichas; las flechas se dibujan solas.',
      local: 'Toca el campo para añadir un jugador de tu equipo.',
      rival: 'Toca el campo para añadir un rival.',
      balon: 'Toca el campo para añadir un balón.',
      cono: 'Toca el campo para colocar un cono.',
      pase: 'Arrastra para dibujar una flecha de pase.',
      conduccion: 'Arrastra para dibujar una conducción.',
      movimiento: 'Arrastra para dibujar un desmarque o movimiento sin balón.',
      tiro: 'Arrastra para dibujar un tiro.',
      zona: 'Arrastra para marcar una zona o espacio de juego.',
      borrar: 'Toca una ficha, una línea o una zona para borrarla.',
    };
    let h = `<p class="suave">${ayudas[E.herramienta]}</p>`;
    const ali = E.doc.alineacion;
    if (ali) {
      h += `<label class="campo-form">Sistema de la alineación<select id="pSistemaAli">${BIB.sistemas.filter((s) => s.mod === E.doc.mod)
        .map((s) => `<option value="${s.id}"${s.id === ali.sistema ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></label>
        <p class="suave">Al cambiar de sistema se recolocan las mismas jugadoras.</p>`;
    }
    cont.innerHTML = h;
    $('#pSistemaAli')?.addEventListener('change', (e) => {
      const doc = docAlineacion({ ...ali.datos, mod: E.doc.mod }, e.target.value);
      doc.titulo = E.doc.titulo;
      cargarDoc(doc);
    });
    return;
  }
  let h = '';
  if (el.tipo === 'jugador') {
    h += `<div class="fila"><strong>${el.equipo === 'local' ? 'Jugador/a de tu equipo' : 'Rival'}</strong></div>`;
    h += `<label class="campo-form">Dorsal o texto<input id="pDorsal" maxlength="3" value="${esc(el.etiqueta)}"></label>`;
    h += `<label class="campo-form">Puesto<input id="pPuesto" maxlength="6" value="${esc(el.puesto || '')}" placeholder="DFC, ALA, PIV…"></label>`;
    h += `<label class="check"><input type="checkbox" id="pPortero" ${el.portero ? 'checked' : ''}> Portero/a</label>`;
  } else if (el.tipo === 'balon') {
    h += '<div class="fila"><strong>Balón</strong></div>';
    const hay = E.paso < E.doc.pasos.length - 1;
    if (hay) {
      const est = E.doc.pasos[E.paso].estilos?.[id] || 'auto';
      h += '<div class="suave">Golpeo en este paso</div><div class="segmentado" id="pGolpeo">';
      [['auto', 'Auto'], ['pase', 'Pase'], ['centro', 'Centro'], ['tiro', 'Tiro']].forEach(([v, t]) => {
        h += `<button data-v="${v}" class="${est === v ? 'activo' : ''}">${t}</button>`;
      });
      h += '</div>';
    } else {
      h += '<p class="suave">Añade un paso y mueve el balón para indicar si es pase, centro o tiro.</p>';
    }
  } else {
    h += '<div class="fila"><strong>Cono</strong></div>';
  }
  h += '<button class="btn peligro ancho" id="pEliminar">Eliminar de la pizarra</button>';
  cont.innerHTML = h;
  const ent = (sel, prop) => {
    const i = $(sel);
    if (i) i.addEventListener('input', () => { el[prop] = i.value.trim(); render(); });
  };
  ent('#pDorsal', 'etiqueta');
  ent('#pPuesto', 'puesto');
  $('#pPortero')?.addEventListener('change', (e) => { el.portero = e.target.checked; render(); });
  $('#pGolpeo')?.addEventListener('click', (e) => {
    const v = e.target.dataset.v;
    if (!v) return;
    const est = E.doc.pasos[E.paso].estilos || (E.doc.pasos[E.paso].estilos = {});
    if (v === 'auto') delete est[id]; else est[id] = v;
    render(); actualizarProps();
  });
  $('#pEliminar').addEventListener('click', () => eliminarElemento(id));
}

// ------------------------------------------------------------------ Edición
function puntoN(ev) {
  const pt = lienzo.createSVGPoint();
  pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(lienzo.getScreenCTM().inverse());
  const c = CAMPOS[E.doc.mod];
  return [p.x / c.W, p.y / c.L];
}
const limitar = (p) => [Math.min(1.06, Math.max(-0.06, p[0])), Math.min(1.05, Math.max(-0.05, p[1]))];
const iguales = (p, q) => p && q && Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;

function anadir(tipo, p) {
  const d = E.doc;
  let id; let info;
  if (tipo === 'local' || tipo === 'rival') {
    const pref = tipo === 'local' ? 'a' : 'r';
    let k = 1;
    while (d.elementos[pref + k]) k++;
    id = pref + k;
    info = { tipo: 'jugador', equipo: tipo, etiqueta: tipo === 'local' ? String(k) : '', portero: false };
  } else {
    const pref = tipo === 'balon' ? 'b' : 'k';
    let k = tipo === 'balon' ? '' : 1;
    while (d.elementos[pref + k]) k = (k || 1) + 1;
    id = pref + k;
    info = { tipo: tipo === 'balon' ? 'balon' : 'cono' };
  }
  d.elementos[id] = info;
  d.pasos.forEach((ps) => { ps.pos[id] = p; });
  E.sel = id;
}

function eliminarElemento(id) {
  delete E.doc.elementos[id];
  E.doc.pasos.forEach((ps) => { delete ps.pos[id]; if (ps.estilos) delete ps.estilos[id]; });
  E.sel = null;
  render(); actualizarProps();
}

lienzo.addEventListener('pointerdown', (ev) => {
  if (E.anim) parar();
  const p = puntoN(ev);
  const obj = ev.target.closest('[data-id],[data-linea],[data-zona]');
  const h = E.herramienta;
  const paso = E.doc.pasos[E.paso];
  if (h === 'mover') {
    if (obj?.dataset.id) {
      const id = obj.dataset.id;
      E.sel = id;
      E.arrastre = { id, inicio: paso.pos[id], dif: [p[0] - paso.pos[id][0], p[1] - paso.pos[id][1]], movido: false };
      lienzo.setPointerCapture(ev.pointerId);
    } else {
      E.sel = null;
    }
  } else if (['local', 'rival', 'balon', 'cono'].includes(h)) {
    anadir(h, limitar(p));
  } else if (['pase', 'conduccion', 'movimiento', 'tiro', 'zona'].includes(h)) {
    E.trazo = { tipo: h, a: p, b: p };
    lienzo.setPointerCapture(ev.pointerId);
  } else if (h === 'borrar' && obj) {
    if (obj.dataset.id) { eliminarElemento(obj.dataset.id); return; }
    if (obj.dataset.linea) paso.lineas.splice(Number(obj.dataset.linea), 1);
    if (obj.dataset.zona) paso.zonas.splice(Number(obj.dataset.zona), 1);
  }
  render(); actualizarProps();
});

lienzo.addEventListener('pointermove', (ev) => {
  if (E.arrastre) {
    const p = puntoN(ev);
    const a = E.arrastre;
    E.doc.pasos[E.paso].pos[a.id] = limitar([p[0] - a.dif[0], p[1] - a.dif[1]]);
    a.movido = true;
    render();
  } else if (E.trazo) {
    E.trazo.b = puntoN(ev);
    render();
  }
});

function soltar() {
  const d = E.doc;
  if (E.arrastre) {
    const a = E.arrastre;
    if (a.movido) {
      const nueva = d.pasos[E.paso].pos[a.id];
      // Los pasos siguientes que tenían la ficha en el mismo sitio se actualizan también
      for (let j = E.paso + 1; j < d.pasos.length; j++) {
        if (iguales(d.pasos[j].pos[a.id], a.inicio)) d.pasos[j].pos[a.id] = nueva; else break;
      }
    }
    E.arrastre = null;
  }
  if (E.trazo) {
    const t = E.trazo;
    if (distM(d, t.a, t.b) > CAMPOS[d.mod].r * 0.8) {
      if (t.tipo === 'zona') d.pasos[E.paso].zonas.push({ a: t.a, b: t.b });
      else d.pasos[E.paso].lineas.push({ tipo: t.tipo, a: t.a, b: t.b, equipo: 'local' });
    }
    E.trazo = null;
  }
  render(); actualizarProps();
}
lienzo.addEventListener('pointerup', soltar);
lienzo.addEventListener('pointercancel', soltar);

// ------------------------------------------------------------------ Pasos y animación
function irA(i) {
  if (E.anim) parar();
  E.paso = Math.max(0, Math.min(E.doc.pasos.length - 1, i));
  render(); actualizarUI();
}

function anadirPaso() {
  if (E.anim) parar();
  const actual = E.doc.pasos[E.paso];
  E.doc.pasos.splice(E.paso + 1, 0, pasoVacio({ ...actual.pos }));
  E.paso++;
  render(); actualizarUI();
  toast('Paso añadido: mueve las fichas y se dibujarán las flechas en el paso anterior.');
}

function borrarPaso() {
  if (E.doc.pasos.length <= 1) return;
  E.doc.pasos.splice(E.paso, 1);
  E.paso = Math.min(E.paso, E.doc.pasos.length - 1);
  render(); actualizarUI();
}

function parar() {
  if (!E.anim) return;
  cancelAnimationFrame(E.anim.raf);
  clearTimeout(E.anim.espera);
  E.anim = null;
  render(); actualizarUI();
}

function reproducir() {
  if (E.anim) { parar(); return; }
  if (E.doc.pasos.length < 2) { toast('Añade al menos un paso para poder animar la jugada.'); return; }
  if (E.paso >= E.doc.pasos.length - 1) E.paso = 0;
  E.anim = {};
  actualizarUI();
  animarPaso();
}

function animarPaso() {
  const doc = E.doc;
  const i = E.paso;
  if (!E.anim) return;
  if (i >= doc.pasos.length - 1) { parar(); return; }
  const A = doc.pasos[i].pos; const B = doc.pasos[i + 1].pos;
  const c = CAMPOS[doc.mod];
  const estilos = doc.pasos[i].estilos || {};
  const dur = 1400 / E.velocidad;
  const t0 = performance.now();
  $('#textoPaso').value = doc.pasos[i].texto || '';
  const cuadro = (ahora) => {
    if (!E.anim) return;
    const t = Math.min(1, (ahora - t0) / dur);
    const e = ease(t);
    const pos = {};
    for (const id of Object.keys(doc.elementos)) {
      const a = A[id]; const b = B[id];
      if (!a || !b) continue;
      if (doc.elementos[id].tipo === 'balon' && estilos[id] === 'centro') {
        const am = [a[0] * c.W, a[1] * c.L]; const bm = [b[0] * c.W, b[1] * c.L];
        const q = bezier(am, controlCurva(am, bm, c.W, c.L), bm, e);
        pos[id] = [q[0] / c.W, q[1] / c.L];
      } else {
        pos[id] = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
      }
    }
    render({ paso: i, pos, opacidadFlechas: Math.max(0, 0.6 - t) });
    if (t < 1) {
      E.anim.raf = requestAnimationFrame(cuadro);
    } else {
      E.paso = i + 1;
      render(); actualizarUI();
      $('#btnPlay').textContent = '⏸ Pausa';
      E.anim.espera = setTimeout(animarPaso, 900 / E.velocidad);
    }
  };
  E.anim.raf = requestAnimationFrame(cuadro);
}

// ------------------------------------------------------------------ Cargar / guardar
function cargarDoc(doc) {
  if (E.anim) parar();
  E.doc = clonar(doc);
  E.doc.pasos.forEach((p) => { p.estilos ||= {}; p.lineas ||= []; p.zonas ||= []; p.texto ||= ''; });
  E.paso = 0; E.sel = null;
  campoDibujado = '';
  render(); actualizarUI();
}

function leerMias() {
  try { return JSON.parse(localStorage.getItem(CLAVE_MIAS) || '[]'); } catch { return []; }
}
function escribirMias(lista) {
  try { localStorage.setItem(CLAVE_MIAS, JSON.stringify(lista)); return true; } catch { return false; }
}

function guardar() {
  const lista = leerMias();
  const idx = lista.findIndex((x) => x.doc.titulo === E.doc.titulo && x.doc.mod === E.doc.mod);
  const entrada = { id: Date.now(), guardado: new Date().toISOString(), doc: clonar(E.doc) };
  if (idx >= 0) lista[idx] = entrada; else lista.unshift(entrada);
  toast(escribirMias(lista) ? `Guardada en «Mis jugadas»: ${E.doc.titulo}` : 'No se ha podido guardar en este navegador.');
}

function descargar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const nombreArchivo = () => (E.doc.titulo || 'pizarra').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function exportarPNG() {
  const vb = cajaVista(E.doc);
  const ancho = 1600;
  const alto = Math.round((ancho * vb[3]) / vb[2]);
  const selPrev = E.sel; E.sel = null;
  const svg = svgCompleto(E.doc, E.paso, { defs: true, puestos: E.verPuestos, attrs: ` width="${ancho}" height="${alto}"` });
  E.sel = selPrev;
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = ancho; cv.height = alto;
    cv.getContext('2d').drawImage(img, 0, 0, ancho, alto);
    cv.toBlob((b) => descargar(b, `${nombreArchivo()}-paso-${E.paso + 1}.png`), 'image/png');
  };
  img.onerror = () => toast('No se ha podido generar la imagen.');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function exportarJSON() {
  descargar(new Blob([JSON.stringify(E.doc, null, 2)], { type: 'application/json' }), `${nombreArchivo()}.json`);
}

function importarJSON(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const doc = JSON.parse(lector.result);
      if (!doc.elementos || !Array.isArray(doc.pasos) || !CAMPOS[doc.mod]) throw new Error('formato');
      cargarDoc(doc);
      toast('Pizarra importada.');
    } catch {
      toast('El archivo no es una pizarra válida.');
    }
  };
  lector.readAsText(archivo);
}

// ------------------------------------------------------------------ Biblioteca
const B = { pestana: 'jugadas', mod: 'todas', cat: 'todas', texto: '', club: null, cargandoClub: false };

// ------------------------------------------------------------------ Jugadas compartidas en la nube
// main.js (solo con sesión) llama a Pizarra.usarNube({ listar, guardar, borrar }).
let NUBE = null;
async function cargarClub() {
  if (!NUBE || B.cargandoClub) return;
  B.cargandoClub = true;
  try { B.club = await NUBE.listar(); } catch (e) { B.club = { error: e.message || 'sin conexión' }; }
  B.cargandoClub = false;
  if (B.pestana === 'club' && !$('#biblioteca').hidden) pintarBiblioteca();
}
async function compartir(conClub) {
  if (!NUBE) return;
  const doc = clonar(E.doc);
  delete doc.alineacion;
  try {
    const r = await NUBE.guardar(doc, { club: conClub });
    if (r?.id) E.doc.nubeId = r.id;
    B.club = null;
    toast(conClub ? `Compartida con todo el club: ${doc.titulo}` : `Compartida con tu equipo: ${doc.titulo}`);
  } catch (e) {
    toast(`No se ha podido compartir: ${e.message || 'sin conexión'}`);
  }
}

function abrirBiblioteca() {
  B.club = null; // se vuelve a pedir a la nube al abrir la pestaña
  B.mod = E.doc.mod;
  $('#bibMod').value = B.mod;
  $('#biblioteca').hidden = false;
  $('#fondo').hidden = false;
  pintarBiblioteca();
}
function cerrarBiblioteca() { $('#biblioteca').hidden = true; $('#fondo').hidden = true; }

function pintarBiblioteca() {
  document.querySelectorAll('.pestanas button').forEach((b) => b.classList.toggle('activa', b.dataset.tab === B.pestana));
  const filtraMod = (m) => B.mod === 'todas' || m === B.mod;
  const filtraTexto = (t) => !B.texto || t.toLowerCase().includes(B.texto.toLowerCase());
  const lista = $('#bibLista');
  const chips = $('#bibCats');
  $('#bibRival').hidden = B.pestana !== 'sistemas';
  chips.hidden = B.pestana !== 'jugadas';
  let items = [];

  if (B.pestana === 'jugadas') {
    const base = BIB.jugadas.filter((j) => filtraMod(j.mod) && filtraTexto(j.titulo + ' ' + j.desc));
    const cuenta = {};
    base.forEach((j) => { cuenta[j.cat] = (cuenta[j.cat] || 0) + 1; });
    chips.innerHTML = `<button data-cat="todas" class="${B.cat === 'todas' ? 'activa' : ''}">Todas · ${base.length}</button>` +
      Object.entries(BIB.categorias).filter(([k]) => cuenta[k])
        .map(([k, v]) => `<button data-cat="${k}" class="${B.cat === k ? 'activa' : ''}">${v} · ${cuenta[k]}</button>`).join('');
    items = base.filter((j) => B.cat === 'todas' || j.cat === B.cat).map((j) => ({
      clave: 'j:' + j.id, doc: docDesdeJugada(j), meta: `${CAMPOS[j.mod].nombre} · ${BIB.categorias[j.cat]}`, nivel: j.nivel,
    }));
  } else if (B.pestana === 'sistemas') {
    const sel = $('#selRival');
    const modRival = B.mod === 'todas' ? null : B.mod;
    const opciones = BIB.sistemas.filter((s) => !modRival || s.mod === modRival);
    const previo = sel.value;
    sel.innerHTML = '<option value="">Sin rival</option>' + opciones.map((s) => `<option value="${s.id}">${CAMPOS[s.mod].nombre} · ${s.nombre}</option>`).join('');
    sel.value = opciones.some((s) => s.id === previo) ? previo : '';
    items = BIB.sistemas.filter((s) => filtraMod(s.mod) && filtraTexto(s.nombre + ' ' + s.desc)).map((s) => {
      const rival = BIB.sistemas.find((r) => r.id === sel.value && r.mod === s.mod);
      return { clave: 's:' + s.id, doc: docDesdeSistema(s, rival), meta: CAMPOS[s.mod].nombre, nivel: '' };
    });
  } else if (B.pestana === 'club') {
    if (!B.club) {
      lista.innerHTML = '<p class="vacio">Cargando las jugadas del club…</p>';
      cargarClub();
      return;
    }
    if (B.club.error) { lista.innerHTML = `<p class="vacio">No se han podido cargar: ${esc(B.club.error)}.</p>`; return; }
    items = B.club.filter((x) => CAMPOS[x.doc?.mod] && filtraMod(x.doc.mod) && filtraTexto(x.doc.titulo)).map((x) => ({
      clave: 'c:' + x.id, doc: { ...x.doc, nubeId: x.esMia ? x.id : undefined },
      meta: `${CAMPOS[x.doc.mod].nombre} · ${x.compartidaClub ? 'Todo el club' : x.equipo || 'Equipo'} · ${x.esMia ? 'tuya' : 'de otro delegado'} · ${new Date(x.fecha).toLocaleDateString('es-ES')}`,
      nivel: '', borrableNube: x.puedeBorrar ? x.id : null,
    }));
  } else {
    items = leerMias().filter((x) => filtraMod(x.doc.mod) && filtraTexto(x.doc.titulo)).map((x) => ({
      clave: 'm:' + x.id, doc: x.doc, meta: `${CAMPOS[x.doc.mod].nombre} · ${new Date(x.guardado).toLocaleDateString('es-ES')}`, nivel: '', borrable: x.id,
    }));
  }

  if (!items.length) {
    const vacio = {
      mias: 'Todavía no has guardado ninguna jugada. Usa «⋯ → Guardar en mis jugadas».',
      club: B.club?.sinEquipo ? 'Entra en «Club» y elige tu equipo para ver las jugadas compartidas.'
        : 'Aún no hay jugadas compartidas. Abre una jugada y usa «⋯ → Compartir con mi equipo» o «con todo el club».',
    };
    lista.innerHTML = `<p class="vacio">${vacio[B.pestana] || 'No hay resultados con estos filtros.'}</p>`;
    return;
  }
  pintarBiblioteca.docs = {};
  lista.innerHTML = items.map((it) => {
    pintarBiblioteca.docs[it.clave] = it.doc;
    return `<article class="ficha" data-clave="${esc(it.clave)}" tabindex="0">
      <div class="mini">${svgCompleto(it.doc, 0, { attrs: ' preserveAspectRatio="xMidYMid meet"' })}</div>
      <div class="ficha-txt">
        <h3>${esc(it.doc.titulo)}</h3>
        <div class="meta">${esc(it.meta)}${it.nivel ? ` · <span>${esc(it.nivel)}</span>` : ''}</div>
        <p>${esc(it.doc.descripcion || '')}</p>
        ${it.borrable ? `<button class="btn peligro mini-btn" data-borrar="${it.borrable}">Borrar</button>` : ''}
        ${it.borrableNube ? `<button class="btn peligro mini-btn" data-borrar-nube="${it.borrableNube}">Dejar de compartir</button>` : ''}
      </div></article>`;
  }).join('');
}

$('#bibLista').addEventListener('click', async (e) => {
  const borrarNube = e.target.closest('[data-borrar-nube]');
  if (borrarNube) {
    e.stopPropagation();
    if (!borrarNube.classList.contains('confirmar')) { borrarNube.classList.add('confirmar'); borrarNube.textContent = '¿Seguro? Toca otra vez'; return; }
    try { await NUBE.borrar(borrarNube.dataset.borrarNube); toast('Jugada retirada de la nube.'); } catch (err) { toast(`No se ha podido borrar: ${err.message}`); }
    B.club = null;
    pintarBiblioteca();
    return;
  }
  const borrar = e.target.closest('[data-borrar]');
  if (borrar) {
    e.stopPropagation();
    escribirMias(leerMias().filter((x) => String(x.id) !== borrar.dataset.borrar));
    pintarBiblioteca();
    return;
  }
  const ficha = e.target.closest('.ficha');
  if (!ficha) return;
  cargarDoc(pintarBiblioteca.docs[ficha.dataset.clave]);
  cerrarBiblioteca();
  if (E.doc.pasos.length > 1) toast('Pulsa ▶ Reproducir para ver la jugada animada.');
});
$('#bibLista').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.closest('.ficha')?.click(); });
$('#bibCats').addEventListener('click', (e) => { const c = e.target.dataset.cat; if (c) { B.cat = c; pintarBiblioteca(); } });
document.querySelector('.pestanas').addEventListener('click', (e) => { const t = e.target.dataset.tab; if (t) { B.pestana = t; pintarBiblioteca(); } });
$('#bibMod').addEventListener('change', (e) => { B.mod = e.target.value; B.cat = 'todas'; pintarBiblioteca(); });
$('#bibBuscar').addEventListener('input', (e) => { B.texto = e.target.value; pintarBiblioteca(); });
$('#selRival').addEventListener('change', pintarBiblioteca);
$('#btnBiblioteca').addEventListener('click', abrirBiblioteca);
$('#cerrarBib').addEventListener('click', cerrarBiblioteca);
$('#fondo').addEventListener('click', cerrarBiblioteca);

// ------------------------------------------------------------------ Controles
$('#herramientas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-h]');
  if (!b) return;
  E.herramienta = b.dataset.h;
  document.querySelectorAll('#herramientas [data-h]').forEach((x) => x.classList.toggle('activa', x === b));
  lienzo.dataset.herramienta = E.herramienta;
  actualizarProps();
});
$('#btnAnterior').addEventListener('click', () => irA(E.paso - 1));
$('#btnSiguiente').addEventListener('click', () => irA(E.paso + 1));
$('#btnAnadirPaso').addEventListener('click', anadirPaso);
$('#btnBorrarPaso').addEventListener('click', borrarPaso);
$('#btnPlay').addEventListener('click', reproducir);
$('#selVelocidad').addEventListener('change', (e) => { E.velocidad = Number(e.target.value); });
$('#textoPaso').addEventListener('input', (e) => { E.doc.pasos[E.paso].texto = e.target.value; });
$('#descripcion').addEventListener('input', (e) => { E.doc.descripcion = e.target.value; });
$('#titulo').addEventListener('input', (e) => { E.doc.titulo = e.target.value; });
$('#selMod').addEventListener('change', (e) => {
  E.doc.mod = e.target.value;
  if (E.doc.vista === 'encuadre') E.doc.vista = 'completo';
  E.doc.encuadre = null;
  render(); actualizarUI();
});
$('#selVista').addEventListener('change', (e) => { E.doc.vista = e.target.value; render(); });

$('#btnMenu').addEventListener('click', (e) => { e.stopPropagation(); $('#menu').hidden = !$('#menu').hidden; });
document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) $('#menu').hidden = true; });
$('#menu').addEventListener('click', (e) => {
  const acc = e.target.closest('[data-acc]')?.dataset.acc;
  if (!acc) return;
  $('#menu').hidden = true;
  if (acc === 'nueva') cargarDoc(docVacio(E.doc.mod));
  if (acc === 'guardar') guardar();
  if (acc === 'compartir-equipo') compartir(false);
  if (acc === 'compartir-club') compartir(true);
  if (acc === 'png') exportarPNG();
  if (acc === 'json') exportarJSON();
  if (acc === 'importar') $('#archivo').click();
});
$('#archivo').addEventListener('change', (e) => { if (e.target.files[0]) importarJSON(e.target.files[0]); e.target.value = ''; });
$('#chkPuestos').addEventListener('change', (e) => { E.verPuestos = e.target.checked; render(); });

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'ArrowRight') irA(E.paso + 1);
  else if (e.key === 'ArrowLeft') irA(E.paso - 1);
  else if (e.key === ' ') { e.preventDefault(); reproducir(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && E.sel) eliminarElemento(E.sel);
  else if (e.key === 'Escape') cerrarBiblioteca();
});

// ------------------------------------------------------------------ Inicio
(function iniciar() {
  // Enlace directo a una jugada: …#id-de-la-jugada (p. ej. #sala-corner-cierre)
  const id = decodeURIComponent(location.hash.slice(1));
  const j = BIB.jugadas.find((x) => x.id === id) || BIB.jugadas.find((x) => x.id === 'f7-corner-corto');
  cargarDoc(docDesdeJugada(j));
})();
