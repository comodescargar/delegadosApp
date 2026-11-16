// Fin de temporada: copia de seguridad y borrado de los datos personales del equipo (RGPD).
// - Copia: archivo con las fichas (fotos incluidas) y el historial de partidos.
// - Borrar fotos: quita fotos de fichas, licencias y DNI de la nube y de los móviles; quedan nombres y estadísticas.
// - Borrar todo el equipo (solo administración del club): fichas, fotos, partidos y nombres de las jugadoras.
// - Borrar este móvil: quita lo guardado en este dispositivo y cierra la sesión.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function crearFinTemporada(sb, { aviso, equipoActivo, pararSinc, reanudarSinc, pendientes }) {
  const FA = () => window.FichasApp;
  const comprobar = ({ error }, que) => { if (error) throw new Error(`${que}: ${error.message}`); };

  // Historial de la temporada para la copia de seguridad (legible: con nombres)
  FA()?.usarHistorial(async () => {
    const eq = equipoActivo();
    if (!eq) return null;
    const [pa, fi] = await Promise.all([
      sb.from('partidos').select('id, rival, fecha, minutos_parte').eq('equipo_id', eq.id).order('creado_en'),
      sb.from('fichas').select('id, dorsal, tipo, cargo, jugadoras(nombre)').eq('equipo_id', eq.id),
    ]);
    comprobar(pa, 'Leer partidos');
    comprobar(fi, 'Leer fichas');
    const ids = pa.data.map((p) => p.id);
    const vacio = { data: [], error: null };
    const [co, ev] = await Promise.all([
      ids.length ? sb.from('convocatorias').select('partido_id, ficha_id, dorsal_partido, titular, segundos_jugados').in('partido_id', ids) : vacio,
      ids.length ? sb.from('eventos').select('partido_id, tipo, ficha_id, ficha_entra, minuto, parte').in('partido_id', ids) : vacio,
    ]);
    comprobar(co, 'Leer convocatorias');
    comprobar(ev, 'Leer eventos');
    const nombre = Object.fromEntries(fi.data.map((f) => [f.id, f.jugadoras?.nombre || '']));
    return {
      partidos: pa.data.map((p) => ({
        fecha: p.fecha, rival: p.rival, minutosParte: p.minutos_parte,
        convocadas: co.data.filter((c) => c.partido_id === p.id).map((c) => ({
          nombre: nombre[c.ficha_id] || '', dorsal: c.dorsal_partido, titular: c.titular, segundosJugados: c.segundos_jugados,
        })),
        eventos: ev.data.filter((e) => e.partido_id === p.id).map((e) => ({
          tipo: e.tipo, minuto: e.minuto, parte: e.parte, quien: nombre[e.ficha_id] || '', entra: nombre[e.ficha_entra] || undefined,
        })),
      })),
    };
  });

  async function rutasDeFotos(eq) {
    const { data, error } = await sb.from('fichas').select('foto_path').eq('equipo_id', eq.id);
    if (error) throw new Error(`Leer fichas: ${error.message}`);
    const rutas = new Set(data.map((f) => f.foto_path).filter(Boolean));
    // Por si quedó alguna foto suelta en la carpeta del equipo
    try {
      const lista = await sb.storage.from('fichas').list?.(eq.id, { limit: 1000 });
      (lista?.data || []).forEach((o) => { if (o.name && o.id !== null) rutas.add(`${eq.id}/${o.name}`); });
    } catch { /* opcional */ }
    return [...rutas];
  }

  async function borrarArchivos(rutas) {
    for (let i = 0; i < rutas.length; i += 100) {
      const { error } = await sb.storage.from('fichas').remove(rutas.slice(i, i + 100));
      if (error) throw new Error(`Borrar fotos: ${error.message}`);
    }
  }

  async function anularEnlaces(eq) {
    const { data } = await sb.from('partidos').select('id').eq('equipo_id', eq.id);
    const ids = (data || []).map((p) => p.id);
    if (ids.length) await sb.from('enlaces_arbitro').update({ revocado: true }).in('partido_id', ids);
  }

  async function borrarFotos(eq) {
    const rutas = await rutasDeFotos(eq);
    await anularEnlaces(eq);
    await borrarArchivos(rutas);
    comprobar(await sb.from('fichas').update({ foto_path: null }).eq('equipo_id', eq.id), 'Quitar fotos de las fichas');
    await FA().quitarFotosDelMovil(eq.id);
    return rutas.length;
  }

  async function borrarTodo(eq) {
    const rutas = await rutasDeFotos(eq);
    await pararSinc();
    try {
      await borrarArchivos(rutas);
      comprobar(await sb.from('partidos').delete().eq('equipo_id', eq.id), 'Borrar partidos');
      comprobar(await sb.from('fichas').delete().eq('equipo_id', eq.id), 'Borrar fichas');
      const { data: n, error } = await sb.rpc('limpiar_jugadoras_sin_ficha', { p_club: eq.club_id });
      if (error) throw new Error(`Borrar nombres de jugadoras: ${error.message}`);
      await FA().borrarDelMovil(eq.id);
      return { fotos: rutas.length, nombres: n || 0 };
    } finally {
      await reanudarSinc();
    }
  }

  // ---------------------------------------------------------------- Pintado
  function html(eq, esAdmin) {
    return `<details class="club-fin" id="clubFin">
      <summary>Copia de seguridad y fin de temporada</summary>
      <p class="nota">Las fichas llevan fotos y documentos de menores: guárdalos solo mientras hagan falta.
        Al acabar la temporada, descarga una copia y borra lo que ya no se necesite.</p>

      <div class="club-fin-paso">
        <strong>1. Copia de seguridad</strong>
        <p class="nota">Un archivo con las fichas (con fotos) y todos los partidos de <strong>${esc(eq.nombre)}</strong>.
          Se puede cargar después en «Fichas → Pasar fichas y copias de seguridad».</p>
        <button class="btn" data-fin="copia">Descargar copia</button>
      </div>

      <div class="club-fin-paso">
        <strong>2. Borrar fotos y documentos</strong>
        <p class="nota">Quita las fotos de fichas, licencias y DNI de la nube y de los móviles del equipo.
          Se mantienen los nombres, dorsales y estadísticas. Los enlaces del árbitro dejan de funcionar.</p>
        <button class="btn peligro" data-fin="fotos">Borrar fotos</button>
      </div>

      ${esAdmin ? `<div class="club-fin-paso">
        <strong>3. Borrar todo el equipo</strong>
        <p class="nota">Borra fichas, fotos, partidos, convocatorias, goles y los nombres de las jugadoras.
          El equipo y sus miembros se mantienen (vacío para la temporada siguiente). <strong>No se puede deshacer.</strong></p>
        <input class="entrada" id="finConfirmar" placeholder="Escribe ${esc(eq.nombre)} para confirmar" autocomplete="off">
        <button class="btn peligro" data-fin="todo">Borrar todo el equipo</button>
      </div>` : ''}

      <div class="club-fin-paso">
        <strong>${esAdmin ? '4' : '3'}. Dejar este móvil</strong>
        <p class="nota">Borra las fichas y partidos guardados en este dispositivo y cierra la sesión. En la nube no se borra nada.</p>
        <button class="btn" data-fin="movil">Borrar este móvil y salir</button>
      </div>
    </details>`;
  }

  // Doble toque para confirmar
  function confirmar(b, texto) {
    if (b.classList.contains('confirmar')) { b.classList.remove('confirmar'); return true; }
    const original = b.textContent;
    b.classList.add('confirmar');
    b.textContent = texto;
    setTimeout(() => { if (b.classList.contains('confirmar')) { b.classList.remove('confirmar'); b.textContent = original; } }, 4000);
    return false;
  }

  async function manejar(e) {
    const b = e.target.closest('[data-fin]');
    if (!b) return;
    const eq = equipoActivo();
    if (!eq) { aviso('Elige primero un equipo.'); return; }
    const accion = b.dataset.fin;
    const textoBoton = b.textContent;
    const ocupado = (t) => { b.disabled = true; b.textContent = t; };
    const libre = (t = textoBoton) => { b.disabled = false; b.textContent = t; };
    try {
      if (accion === 'copia') {
        ocupado('Preparando copia…');
        await FA().descargarCopia();
        libre();
      }
      if (accion === 'fotos') {
        if (!confirmar(b, '¿Borrar todas las fotos? Toca otra vez')) return;
        ocupado('Borrando fotos…');
        const n = await borrarFotos(eq);
        libre('Borrar fotos');
        aviso(`Fotos borradas (${n} archivos) de ${eq.nombre}.`);
      }
      if (accion === 'todo') {
        const escrito = document.getElementById('finConfirmar')?.value.trim().toLowerCase();
        if (escrito !== eq.nombre.trim().toLowerCase()) { aviso(`Escribe «${eq.nombre}» en el recuadro para confirmar.`); return; }
        if (!confirmar(b, '¿Seguro? No se puede deshacer. Toca otra vez')) return;
        ocupado('Borrando…');
        const r = await borrarTodo(eq);
        libre('Borrar todo el equipo');
        document.getElementById('finConfirmar').value = '';
        aviso(`${eq.nombre} ha quedado vacío: ${r.fotos} fotos y ${r.nombres} nombres de jugadoras borrados.`);
      }
      if (accion === 'movil') {
        const n = pendientes();
        if (!confirmar(b, n ? `Hay ${n} cambios sin subir que se perderán. Toca otra vez` : '¿Borrar este móvil y salir? Toca otra vez')) return;
        ocupado('Borrando…');
        await pararSinc(true);
        await FA().borrarDelMovil(null);
        await sb.auth.signOut();
        aviso('Este móvil ya no guarda fichas ni partidos. La sesión se ha cerrado.');
      }
    } catch (err) {
      console.error(err);
      libre();
      aviso(`No se ha podido completar: ${err.message}`);
    }
  }

  return { html, manejar };
}
