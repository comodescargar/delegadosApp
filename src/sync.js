// Sincronización de fichas, partido y goles de un equipo con Supabase.
//
// El móvil es la copia de trabajo: fichas.js guarda primero en local (funciona sin cobertura)
// y avisa aquí de cada cambio. Los cambios se apuntan en una cola (localStorage) y se suben
// en cuanto hay conexión. Después se descarga lo que han cambiado otros delegados del equipo.

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CADA_MS = 60_000;

export function crearSincronizador(sb, equipo, { aviso = () => {}, alCambiarEstado = () => {} } = {}) {
  const FA = window.FichasApp;
  const claveCola = `delegado.cola.${equipo.id}`;
  const vacia = () => ({ fichas: {}, borradas: {}, eventos: {}, eventosBorrados: {}, partido: false, minutos: false, cierres: {} });
  let cola = vacia();
  try { cola = { ...vacia(), ...JSON.parse(localStorage.getItem(claveCola) || '{}') }; } catch { /* cola vacía */ }
  const guardarCola = () => { try { localStorage.setItem(claveCola, JSON.stringify(cola)); } catch { /* sin almacenamiento */ } };
  const pendientes = () => Object.keys(cola.fichas).length + Object.keys(cola.borradas).length
    + Object.keys(cola.eventos).length + Object.keys(cola.eventosBorrados).length + (cola.partido ? 1 : 0)
    + (cola.minutos ? 1 : 0) + Object.keys(cola.cierres).length;

  let estado = { texto: 'Conectando…', tipo: 'info' };
  const ponerEstado = (texto, tipo = 'info') => { estado = { texto, tipo }; alCambiarEstado(estado); };
  let ocupado = false;
  let temporizador = null;
  let activo = true;

  const fichasDelEquipo = async () => (await FA.todasLocales()).filter((f) => f.equipoId === equipo.id);
  const comprobar = ({ error }, que) => { if (error) throw new Error(`${que}: ${error.message}`); };

  // ---------------------------------------------------------------- Subida
  async function asegurarPartido() {
    const P = FA.partido();
    if (!P.partidoId) {
      const { data, error } = await sb.from('partidos')
        .insert({ equipo_id: equipo.id, rival: P.rival || '', minutos_parte: P.duracion || 25, fecha: new Date().toISOString() })
        .select('id').single();
      comprobar({ error }, 'Crear partido');
      P.partidoId = data.id;
      FA.guardarPartido();
      // La convocatoria del partido nuevo hay que subirla entera
      for (const f of await fichasDelEquipo()) cola.fichas[f.id] = true;
      cola.partido = false;
      guardarCola();
    } else if (cola.partido) {
      comprobar(await sb.from('partidos').update({ rival: P.rival || '', minutos_parte: P.duracion || 25 }).eq('id', P.partidoId), 'Actualizar partido');
      cola.partido = false;
      guardarCola();
    }
    return P.partidoId;
  }

  async function subirFicha(f, partidoId) {
    if (!f.jugadoraId) {
      const { data, error } = await sb.from('jugadoras').insert({ club_id: equipo.club_id, nombre: f.nombre || 'Sin nombre' }).select('id').single();
      comprobar({ error }, 'Crear jugadora');
      f.jugadoraId = data.id;
      f.nombreSubido = f.nombre || 'Sin nombre';
      await FA.guardarLocal(f);
    } else if ((f.nombre || 'Sin nombre') !== f.nombreSubido) {
      comprobar(await sb.from('jugadoras').update({ nombre: f.nombre || 'Sin nombre' }).eq('id', f.jugadoraId), 'Cambiar nombre');
      f.nombreSubido = f.nombre || 'Sin nombre';
    }
    if (f.imagen && !f.fotoPath) {
      const ruta = `${equipo.id}/${f.id}.jpg`;
      comprobar(await sb.storage.from('fichas').upload(ruta, f.imagen, { upsert: true, contentType: f.imagen.type || 'image/jpeg' }), 'Subir foto');
      f.fotoPath = ruta;
    }
    const staff = f.tipo === 'staff';
    comprobar(await sb.from('fichas').upsert({
      id: f.id, equipo_id: equipo.id, jugadora_id: f.jugadoraId, foto_path: f.fotoPath || null,
      tipo: staff ? 'staff' : 'jugadora', cargo: staff ? f.cargo || 'entrenador' : null, dorsal: staff ? null : f.dorsal || null,
    }), 'Guardar ficha');
    f.enNube = true;
    await FA.guardarLocal(f);
    if (f.convocada) {
      comprobar(await sb.from('convocatorias').upsert({
        partido_id: partidoId, ficha_id: f.id, dorsal_partido: staff ? null : f.dorsalPartido || null, titular: !staff && !!f.titular,
      }), 'Guardar convocatoria');
    } else {
      comprobar(await sb.from('convocatorias').delete().eq('partido_id', partidoId).eq('ficha_id', f.id), 'Quitar de la convocatoria');
    }
  }

  async function vaciarCola() {
    if (!pendientes()) return true;
    const partidoId = await asegurarPartido();
    for (const [id, ruta] of Object.entries(cola.borradas)) {
      comprobar(await sb.from('fichas').delete().eq('id', id), 'Borrar ficha');
      if (ruta) await sb.storage.from('fichas').remove([ruta]);
      delete cola.borradas[id];
      guardarCola();
    }
    const locales = Object.fromEntries((await fichasDelEquipo()).map((f) => [f.id, f]));
    for (const id of Object.keys(cola.fichas)) {
      if (locales[id]) await subirFicha(locales[id], partidoId);
      delete cola.fichas[id];
      guardarCola();
    }
    for (const id of Object.keys(cola.eventosBorrados)) {
      comprobar(await sb.from('eventos').delete().eq('id', id), 'Quitar gol');
      delete cola.eventosBorrados[id];
      guardarCola();
    }
    const P = FA.partido();
    for (const id of Object.keys(cola.eventos)) {
      const ev = P.eventos.find((e) => e.id === id);
      if (ev && ES_UUID.test(ev.id)) {
        const enNube = (fid) => (fid && locales[fid]?.enNube ? fid : null);
        comprobar(await sb.from('eventos').upsert({
          id: ev.id, partido_id: partidoId, tipo: ev.tipo === 'rival' ? 'gol_rival' : ev.tipo,
          ficha_id: ev.tipo === 'rival' ? null : enNube(ev.fichaId),
          ficha_entra: ev.tipo === 'cambio' ? enNube(ev.entraId) : null,
          minuto: ev.min ?? null, parte: ev.parte || 1, segundo: ev.seg ?? null,
        }), 'Guardar lo apuntado en el partido');
      }
      delete cola.eventos[id];
      guardarCola();
    }
    // Minutos jugados del partido en curso (los calcula el móvil que lleva el reloj)
    if (cola.minutos) {
      await subirMinutos(partidoId, FA.segundosJugados(), locales);
      cola.minutos = false;
      guardarCola();
    }
    // Minutos finales de partidos ya cerrados en este móvil
    for (const [pid, seg] of Object.entries(cola.cierres)) {
      await subirMinutos(pid, seg, locales, true);
      delete cola.cierres[pid];
      guardarCola();
    }
    return !pendientes();
  }

  // cerrado = partido anterior: las fichas ya tienen la convocatoria del siguiente, así que solo cuenta quién jugó
  async function subirMinutos(partidoId, seg, locales, cerrado = false) {
    if (!seg || !ES_UUID.test(partidoId || '')) return;
    const filas = Object.values(locales)
      .filter((f) => f.enNube && f.tipo !== 'staff' && (cerrado ? seg[f.id] > 0 : f.convocada))
      .map((f) => ({ partido_id: partidoId, ficha_id: f.id, segundos_jugados: Math.max(0, Math.round(seg[f.id] || 0)) }));
    if (!filas.length) return;
    comprobar(await sb.from('convocatorias').upsert(filas, { onConflict: 'partido_id,ficha_id' }), 'Guardar minutos jugados');
  }

  // ---------------------------------------------------------------- Bajada
  async function bajar() {
    const [fi, pa] = await Promise.all([
      sb.from('fichas').select('id, dorsal, foto_path, jugadora_id, tipo, cargo, creada_en, jugadoras(nombre)').eq('equipo_id', equipo.id).eq('activa', true),
      sb.from('partidos').select('id, rival, minutos_parte').eq('equipo_id', equipo.id).order('creado_en', { ascending: false }).limit(1),
    ]);
    comprobar(fi, 'Leer fichas');
    comprobar(pa, 'Leer partido');
    const P = FA.partido();
    const ultimo = pa.data[0] || null;
    const conv = {};
    let eventos = null;
    if (ultimo) {
      // Si otro delegado ha empezado un partido más reciente, se pasa a ese
      if (P.partidoId !== ultimo.id) {
        Object.assign(P, { partidoId: ultimo.id, parte: 1, acumulado: 0, desde: null, eventos: [], enlaceArbitro: null, duraciones: [] });
      }
      P.rival = ultimo.rival || '';
      P.duracion = ultimo.minutos_parte || P.duracion;
      const [co, ev] = await Promise.all([
        sb.from('convocatorias').select('ficha_id, dorsal_partido, titular').eq('partido_id', ultimo.id),
        sb.from('eventos').select('id, tipo, ficha_id, ficha_entra, minuto, parte, segundo').eq('partido_id', ultimo.id).order('creado_en'),
      ]);
      comprobar(co, 'Leer convocatoria');
      comprobar(ev, 'Leer goles');
      co.data.forEach((c) => { conv[c.ficha_id] = c; });
      eventos = ev.data;
    }

    // Fichas: lo de la nube manda, salvo los cambios de este móvil que aún no se han subido
    const locales = Object.fromEntries((await fichasDelEquipo()).map((f) => [f.id, f]));
    const enNube = new Set();
    const descargas = [];
    for (const r of fi.data) {
      enNube.add(r.id);
      const f = locales[r.id] || { id: r.id, equipoId: equipo.id, creada: Date.parse(r.creada_en) || Date.now(), imagen: null };
      if (!cola.fichas[r.id]) {
        const c = conv[r.id];
        Object.assign(f, {
          tipo: r.tipo || 'jugadora', cargo: r.cargo || null,
          nombre: r.jugadoras?.nombre || '', nombreSubido: r.jugadoras?.nombre || '', dorsal: r.dorsal || '',
          dorsalPartido: c?.dorsal_partido || '', convocada: ultimo ? !!c : true, titular: !!c?.titular,
        });
      }
      Object.assign(f, { jugadoraId: r.jugadora_id, enNube: true });
      if (r.foto_path && (r.foto_path !== f.fotoPath || !f.imagen)) {
        descargas.push((async () => {
          const { data, error } = await sb.storage.from('fichas').download(r.foto_path);
          if (!error && data) { f.imagen = data; f.fotoPath = r.foto_path; FA.olvidarImagen(f.id); }
        })());
      } else if (r.foto_path) {
        f.fotoPath = r.foto_path;
      }
      locales[r.id] = f;
    }
    await Promise.all(descargas);
    for (const f of Object.values(locales)) {
      if (enNube.has(f.id) || !f.enNube || cola.fichas[f.id]) await FA.guardarLocal(f);
      else { await FA.borrarLocal(f.id); FA.olvidarImagen(f.id); } // borrada por otro delegado
    }

    // Goles del partido: los de la nube más los de este móvil pendientes de subir
    if (eventos) {
      const porId = Object.fromEntries(Object.values(locales).map((f) => [f.id, f]));
      const dorsalDe = (f) => f?.dorsalPartido || f?.dorsal || '';
      const deNube = eventos.filter((e) => !cola.eventosBorrados[e.id]).map((e) => ({
        id: e.id, tipo: e.tipo === 'gol_rival' ? 'rival' : e.tipo, fichaId: e.ficha_id, min: e.minuto, parte: e.parte,
        ...(e.tipo === 'cambio' ? { entraId: e.ficha_entra } : {}), ...(e.segundo != null ? { seg: e.segundo } : {}),
        dorsal: e.ficha_id ? dorsalDe(porId[e.ficha_id]) : '', nombre: e.ficha_id ? porId[e.ficha_id]?.nombre || '' : '',
      }));
      const idsNube = new Set(deNube.map((e) => e.id));
      const propios = P.eventos.filter((e) => cola.eventos[e.id] && !idsNube.has(e.id));
      P.eventos = [...deNube, ...propios];
    }
    FA.guardarPartido();
    await FA.recargar();
  }

  // ---------------------------------------------------------------- Ciclo
  async function sincronizar() {
    if (!activo || ocupado) return;
    if (!navigator.onLine) { ponerEstado(`Sin conexión · ${pendientes()} cambios se subirán al volver la cobertura`, 'aviso'); return; }
    ocupado = true;
    ponerEstado('Sincronizando…');
    try {
      const todo = await vaciarCola();
      if (todo) await bajar();
      if (todo && refrescarFotosEnlace && enlaceVigente()) { await actualizarFotosEnlace(); refrescarFotosEnlace = false; }
      const n = pendientes();
      ponerEstado(n ? `${n} cambios pendientes de subir` : `Sincronizado · ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, n ? 'aviso' : 'ok');
    } catch (e) {
      console.error(e);
      const red = /fetch|network|load failed|conexi/i.test(e.message);
      if (red) ponerEstado(`Sin conexión · ${pendientes()} cambios se subirán al volver la cobertura`, 'aviso');
      else ponerEstado(`No se ha podido sincronizar (${e.message}). Se reintentará solo.`, 'error');
    } finally {
      ocupado = false;
    }
  }
  function programar(ms = 800) {
    clearTimeout(temporizador);
    temporizador = setTimeout(sincronizar, ms);
    ponerEstado(`${pendientes()} cambios pendientes de subir`, 'aviso');
  }

  const alVolverConexion = () => sincronizar();
  const alVolverVisible = () => { if (!document.hidden) sincronizar(); };
  window.addEventListener('online', alVolverConexion);
  document.addEventListener('visibilitychange', alVolverVisible);
  const intervalo = setInterval(() => { if (!document.hidden) sincronizar(); }, CADA_MS);

  // ---------------------------------------------------------------- Fichas guardadas solo en el móvil
  async function fichasSoloMovil() {
    return (await FA.todasLocales()).filter((f) => !f.equipoId);
  }
  async function subirFichasDelMovil() {
    const locales = await fichasSoloMovil();
    for (const f of locales) {
      const nueva = {
        ...f, id: ES_UUID.test(f.id) ? f.id : FA.uuid(), equipoId: equipo.id,
        jugadoraId: null, fotoPath: null, enNube: false, nombreSubido: undefined,
      };
      await FA.guardarLocal(nueva);
      if (nueva.id !== f.id) { await FA.borrarLocal(f.id); FA.olvidarImagen(f.id); }
      cola.fichas[nueva.id] = true;
    }
    guardarCola();
    await FA.recargar();
    await sincronizar();
    return locales.length;
  }

  // ---------------------------------------------------------------- Enlace para el árbitro
  // Enlaces temporales a las fotos de las convocadas, válidos hasta que caduque el enlace
  async function fotosFirmadas(segundos) {
    const conv = (await fichasDelEquipo()).filter((f) => f.convocada && f.fotoPath);
    if (!conv.length) return {};
    const { data, error } = await sb.storage.from('fichas').createSignedUrls(conv.map((f) => f.fotoPath), Math.max(60, Math.round(segundos)));
    if (error) throw new Error(`Preparar fotos: ${error.message}`);
    const porRuta = Object.fromEntries(conv.map((f) => [f.fotoPath, f.id]));
    return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [porRuta[d.path], d.signedUrl]));
  }
  const enlaceVigente = () => {
    const e = FA.partido().enlaceArbitro;
    return e && new Date(e.validoHasta) > new Date() ? e : null;
  };
  let refrescarFotosEnlace = false;

  async function crearEnlaceArbitro(horas = 8) {
    if (!navigator.onLine) throw new Error('Hace falta conexión para crear el enlace.');
    await sincronizar();
    if (pendientes()) throw new Error('Quedan cambios sin subir. Revisa la conexión e inténtalo otra vez.');
    const P = FA.partido();
    const partidoId = await asegurarPartido();
    await vaciarCola();
    const fotos = await fotosFirmadas(horas * 3600);
    const { data, error } = await sb.from('enlaces_arbitro')
      .insert({ partido_id: partidoId, fotos, valido_hasta: new Date(Date.now() + horas * 3600_000).toISOString() })
      .select('token, valido_hasta').single();
    if (error) throw new Error(`Crear enlace: ${error.message}`);
    P.enlaceArbitro = { token: data.token, validoHasta: data.valido_hasta };
    FA.guardarPartido();
    return { url: `${location.origin}/a/${data.token}`, validoHasta: data.valido_hasta };
  }

  // Si cambia la convocatoria con el enlace abierto, las fotos de las nuevas convocadas se añaden solas
  async function actualizarFotosEnlace() {
    const e = enlaceVigente();
    if (!e) return;
    const fotos = await fotosFirmadas((new Date(e.validoHasta) - Date.now()) / 1000);
    comprobar(await sb.from('enlaces_arbitro').update({ fotos }).eq('token', e.token), 'Actualizar fotos del enlace');
  }

  async function anularEnlaceArbitro() {
    const P = FA.partido();
    const e = P.enlaceArbitro;
    if (!e) return;
    comprobar(await sb.from('enlaces_arbitro').update({ revocado: true }).eq('token', e.token), 'Anular enlace');
    P.enlaceArbitro = null;
    FA.guardarPartido();
  }

  return {
    // Avisos de fichas.js
    fichaCambiada(f, campo) {
      cola.fichas[f.id] = true;
      if (campo === 'convocada' || campo === 'nueva') refrescarFotosEnlace = true;
      guardarCola(); programar();
    },
    fichaBorrada(f) {
      if (!f) return;
      delete cola.fichas[f.id];
      if (f.enNube) cola.borradas[f.id] = f.fotoPath || null;
      guardarCola(); programar();
    },
    eventoNuevo(ev) { cola.eventos[ev.id] = true; guardarCola(); programar(300); },
    eventoBorrado(id) {
      if (cola.eventos[id]) delete cola.eventos[id]; else cola.eventosBorrados[id] = true;
      guardarCola(); programar(300);
    },
    partidoCambiado() { cola.partido = true; guardarCola(); programar(1500); },
    minutosCambiados() { if (FA.partido().partidoId || cola.partido) { cola.minutos = true; guardarCola(); programar(2000); } },
    cerrarPartido(partidoId, seg) { if (seg && Object.keys(seg).length) { cola.cierres[partidoId] = seg; guardarCola(); } },
    nuevoPartido() {
      // El partido se crea en la nube con el siguiente cambio; los goles pendientes del anterior se descartan
      cola.eventos = {}; cola.eventosBorrados = {}; cola.partido = true; cola.minutos = false;
      guardarCola(); programar();
    },
    // Para la sección Club
    sincronizar,
    estado: () => estado,
    pendientes,
    fichasSoloMovil,
    subirFichasDelMovil,
    crearEnlaceArbitro,
    anularEnlaceArbitro,
    detener() {
      activo = false;
      clearTimeout(temporizador);
      clearInterval(intervalo);
      window.removeEventListener('online', alVolverConexion);
      document.removeEventListener('visibilitychange', alVolverVisible);
    },
  };
}
