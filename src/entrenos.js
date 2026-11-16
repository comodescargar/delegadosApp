// Asistencia a entrenamientos (dentro de la pestaña Temporada).
// Pasar lista: todas aparecen como «vino»; se toca a quien no vino (otra vez = justificada, otra = vino).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ESTADOS = { si: { icono: '✅', texto: 'Vino' }, no: { icono: '❌', texto: 'No vino' }, justificada: { icono: '📝', texto: 'Justificada' } };
const SIGUIENTE = { si: 'no', no: 'justificada', justificada: 'si' };
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fechaBonita = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }); };

export function crearEntrenos(sb, { aviso = () => {} } = {}) {
  const S = { entrenos: [], asistencias: [], lista: null, guardando: false };

  async function cargar(equipoId) {
    let en;
    try { en = await sb.from('entrenamientos').select('id, fecha, nota').eq('equipo_id', equipoId).order('fecha', { ascending: true }); } catch (e) { en = { error: e }; }
    if (en.error) {
      // Si la base de datos aún no tiene la tabla, la temporada se sigue viendo sin entrenamientos
      S.entrenos = []; S.asistencias = []; S.error = en.error.message;
      return;
    }
    const ids = en.data.map((e) => e.id);
    const as = ids.length ? await sb.from('asistencias').select('entrenamiento_id, ficha_id, estado').in('entrenamiento_id', ids) : { data: [] };
    S.entrenos = en.data; S.asistencias = as.data || []; S.error = null;
  }

  // Por jugadora: entrenos con lista, a cuántos vino y justificadas
  function porJugadora() {
    const r = {};
    for (const a of S.asistencias) {
      const x = (r[a.ficha_id] ||= { total: 0, si: 0, justificada: 0 });
      x.total++; if (a.estado === 'si') x.si++; if (a.estado === 'justificada') x.justificada++;
    }
    return r;
  }

  function tarjeta(jugadoras) {
    if (S.error) return '';
    const n = S.entrenos.length;
    const vinieron = S.asistencias.filter((a) => a.estado === 'si').length;
    const media = S.asistencias.length ? Math.round((vinieron / S.asistencias.length) * 100) : 0;
    let h = `<section class="t-tarjeta" aria-labelledby="tTitEnt">
      <div class="t-tarjeta-cab"><h2 id="tTitEnt">Entrenamientos</h2>
        <button class="btn primario" data-ent-abrir="">Pasar lista</button></div>`;
    if (S.lista) h += panelLista(jugadoras);
    if (!n) {
      h += '<p class="nota">Pasa lista en cada entrenamiento y aquí verás la asistencia de cada jugadora.</p>';
    } else {
      h += `<p class="nota">${n} ${n === 1 ? 'entrenamiento' : 'entrenamientos'} · asistencia media ${media}%</p>
        <ul class="e-lista">${[...S.entrenos].reverse().slice(0, 12).map((e) => {
        const as = S.asistencias.filter((a) => a.entrenamiento_id === e.id);
        const si = as.filter((a) => a.estado === 'si').length;
        return `<li><button class="e-fila" data-ent-abrir="${e.id}">
          <span class="e-fecha">${esc(fechaBonita(e.fecha))}</span>
          <span class="t-medidor" aria-hidden="true"><i style="width:${as.length ? (si / as.length) * 100 : 0}%"></i></span>
          <span class="num">${si}/${as.length}</span></button></li>`;
      }).join('')}</ul>`;
    }
    return h + '</section>';
  }

  function panelLista(jugadoras) {
    const L = S.lista;
    const filas = jugadoras.map((j) => {
      const est = L.marcas[j.id] || 'si';
      return `<button class="e-jug ${est}" data-ent-marca="${j.id}" aria-label="${esc(j.nombre)}: ${ESTADOS[est].texto}">
        <b>${esc(j.dorsal || '–')}</b><span>${esc(j.nombre)}</span><i>${ESTADOS[est].icono} ${ESTADOS[est].texto}</i></button>`;
    }).join('');
    const cuenta = jugadoras.filter((j) => (L.marcas[j.id] || 'si') === 'si').length;
    return `<div class="e-panel">
      <div class="e-panel-cab">
        <label>Día <input type="date" class="entrada" id="entFecha" value="${esc(L.fecha)}" max="${hoyISO()}"></label>
        <span class="nota">${cuenta} de ${jugadoras.length} vinieron. Toca a quien no vino (otra vez: justificada).</span>
      </div>
      <div class="e-jugs">${filas || '<p class="nota">No hay jugadoras en el equipo.</p>'}</div>
      <div class="barra-acc">
        <button class="btn primario" data-ent-guardar ${S.guardando ? 'disabled' : ''}>${S.guardando ? 'Guardando…' : 'Guardar lista'}</button>
        <button class="btn" data-ent-cancelar>Cancelar</button>
        ${L.id ? '<button class="btn peligro" data-ent-borrar>Borrar este entreno</button>' : ''}
      </div>
    </div>`;
  }

  function abrir(id) {
    if (id) {
      const e = S.entrenos.find((x) => x.id === id);
      const marcas = Object.fromEntries(S.asistencias.filter((a) => a.entrenamiento_id === id).map((a) => [a.ficha_id, a.estado]));
      S.lista = { id, fecha: e.fecha, marcas };
    } else {
      // Si hoy ya hay entreno, se abre ese
      const hoy = S.entrenos.find((x) => x.fecha === hoyISO());
      if (hoy) return abrir(hoy.id);
      S.lista = { id: null, fecha: hoyISO(), marcas: {} };
    }
  }

  async function guardar(equipoId, jugadoras) {
    const L = S.lista;
    S.guardando = true;
    try {
      const id = L.id || crypto.randomUUID();
      const { error } = await sb.from('entrenamientos').upsert({ id, equipo_id: equipoId, fecha: L.fecha });
      if (error) throw error;
      const filas = jugadoras.map((j) => ({ entrenamiento_id: id, ficha_id: j.id, estado: L.marcas[j.id] || 'si' }));
      if (filas.length) {
        const r = await sb.from('asistencias').upsert(filas, { onConflict: 'entrenamiento_id,ficha_id' });
        if (r.error) throw r.error;
      }
      S.lista = null;
      aviso(`Lista guardada: ${filas.filter((f) => f.estado === 'si').length} de ${filas.length} en el entreno del ${fechaBonita(L.fecha)}.`);
      return true;
    } catch (e) {
      aviso(`No se ha podido guardar la lista: ${e.message || 'sin conexión'}. Inténtalo con cobertura.`);
      return false;
    } finally {
      S.guardando = false;
    }
  }

  async function borrar() {
    const { error } = await sb.from('entrenamientos').delete().eq('id', S.lista.id);
    if (error) { aviso(`No se ha podido borrar: ${error.message}`); return false; }
    S.lista = null;
    aviso('Entrenamiento borrado.');
    return true;
  }

  // Devuelve true si hay que recargar los datos, 'pintar' si basta con repintar
  async function manejar(e, equipoId, jugadoras) {
    const t = e.target;
    const abrirB = t.closest('[data-ent-abrir]');
    if (abrirB) { abrir(abrirB.dataset.entAbrir || null); return 'pintar'; }
    const marca = t.closest('[data-ent-marca]');
    if (marca && S.lista) {
      const id = marca.dataset.entMarca;
      S.lista.marcas[id] = SIGUIENTE[S.lista.marcas[id] || 'si'];
      return 'pintar';
    }
    if (t.closest('[data-ent-cancelar]')) { S.lista = null; return 'pintar'; }
    if (t.closest('[data-ent-guardar]') && S.lista) return (await guardar(equipoId, jugadoras)) ? true : 'pintar';
    if (t.closest('[data-ent-borrar]') && S.lista?.id) {
      const b = t.closest('[data-ent-borrar]');
      if (!b.classList.contains('confirmar')) { b.classList.add('confirmar'); b.textContent = '¿Borrar? Toca otra vez'; return null; }
      return (await borrar()) ? true : 'pintar';
    }
    return null;
  }

  function cambiarFecha(valor) {
    if (!S.lista || !valor) return;
    // Si ya hay un entreno ese día, se edita ese
    const otro = S.entrenos.find((x) => x.fecha === valor && x.id !== S.lista.id);
    if (otro) abrir(otro.id); else S.lista.fecha = valor;
  }

  return { cargar, tarjeta, porJugadora, manejar, cambiarFecha, estado: S };
}
