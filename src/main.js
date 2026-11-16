// Conexión con Supabase: acceso por email, equipos e invitaciones (sección «Club»).
// Si no hay VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, la app sigue en modo local (como la versión 0).
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { crearSincronizador } from './sync.js';
import { crearTemporada } from './temporada.js';
import { crearFinTemporada } from './fin-temporada.js';
import './pwa.js';
import './club.css';

const URL_SB = import.meta.env.VITE_SUPABASE_URL;
// Clave pública: la nueva «publishable» (sb_publishable_…) o la antigua «anon». Nunca la secreta.
const CLAVE_SB = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
if (CLAVE_SB?.startsWith('sb_secret_')) throw new Error('Se ha configurado la clave SECRETA de Supabase en la app. Usa la publishable.');
const CLAVE_EQUIPO = 'delegado.equipoActivo';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const aviso = (m) => (window.toast ? window.toast(m) : console.log(m));
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

const MODALIDADES = { sala: 'Fútbol sala', f7: 'Fútbol 7', f11: 'Fútbol 11' };
const CATEGORIAS = ['Prebenjamín', 'Benjamín', 'Alevín', 'Infantil', 'Cadete', 'Juvenil', 'Sénior'];
const ROLES = { delegado: 'Delegado/a', entrenador: 'Entrenador/a', admin: 'Administración del club' };

if (URL_SB && CLAVE_SB) iniciar(createClient(URL_SB, CLAVE_SB));

function iniciar(sb) {
  const S = { sesion: null, equipos: [], adminDe: [], clubes: {}, invitaciones: [], miembros: [], aceptadas: false };
  let sinc = null;
  let equipoSinc = null;

  // ---------------------------------------------------------------- Equipo activo y sincronización
  async function activarEquipo(eq) {
    await window.FichasApp?.listo;
    if ((eq?.id || null) === (equipoSinc?.id || null)) return;
    sinc?.detener();
    equipoSinc = eq || null;
    sinc = eq ? crearSincronizador(sb, eq, { aviso, alCambiarEstado: pintarNube }) : null;
    await window.FichasApp.usarEquipo(eq || null, sinc);
    await pintarNube();
    await sinc?.sincronizar();
    if (!document.getElementById('appTemporada')?.hidden) temporada.cargar();
  }

  const panelNube = document.getElementById('fNube');
  async function pintarNube() {
    if (!sinc || !equipoSinc) { panelNube.hidden = true; panelNube.innerHTML = ''; return; }
    panelNube.hidden = false;
    const est = sinc.estado();
    const soloMovil = (await sinc.fichasSoloMovil()).length;
    const P = window.FichasApp.partido();
    const enlace = P.enlaceArbitro && new Date(P.enlaceArbitro.validoHasta) > new Date() ? P.enlaceArbitro : null;
    panelNube.innerHTML = `
      <div class="f-nube-cab">
        <div><strong>${esc(equipoSinc.nombre)}</strong> · fichas compartidas con el equipo</div>
        <span class="f-nube-estado ${est.tipo}" role="status">${esc(est.texto)}</span>
        <button class="btn" id="nubeSinc">Sincronizar</button>
      </div>
      ${soloMovil ? `<div class="f-nube-aviso">Tienes <strong>${soloMovil}</strong> ${soloMovil === 1 ? 'ficha guardada' : 'fichas guardadas'} solo en este móvil.
        <button class="btn primario" id="nubeSubir">Subirlas a ${esc(equipoSinc.nombre)}</button></div>` : ''}
      <div class="f-nube-arbitro">
        <button class="btn primario" id="nubeEnlace">${enlace ? 'Crear un enlace nuevo para el árbitro' : 'Enlace para el árbitro'}</button>
        <span class="nota">El árbitro lo abre sin cuenta y ve las convocadas con foto. Caduca en 8 horas.</span>
      </div>
      ${enlace ? enlaceHTML(`${location.origin}/a/${enlace.token}`, enlace.validoHasta) : ''}`;
    const res = panelNube.querySelector('#nubeEnlaceRes');
    if (res) dibujarQR(res);
  }

  function enlaceHTML(url, validoHasta) {
    const hora = new Date(validoHasta).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `<div class="f-nube-enlace" id="nubeEnlaceRes" data-url="${esc(url)}">
      <div class="f-nube-qr"></div>
      <div class="f-nube-enlace-txt">
        <input class="entrada" id="nubeEnlaceUrl" readonly value="${esc(url)}" aria-label="Enlace para el árbitro">
        <div class="barra-acc">
          <button class="btn" id="nubeCopiar">Copiar</button>
          ${navigator.share ? '<button class="btn" id="nubeCompartir">Compartir</button>' : ''}
          <button class="btn peligro" id="nubeAnular">Anular enlace</button>
        </div>
        <span class="nota">Válido hasta las ${hora}. El árbitro puede escanear el código QR.
          Si cambias la convocatoria, el enlace se actualiza solo al sincronizar.</span>
      </div>
    </div>`;
  }
  async function dibujarQR(cont) {
    try {
      const src = await QRCode.toDataURL(cont.dataset.url, { margin: 1, width: 220 });
      cont.querySelector('.f-nube-qr').innerHTML = `<img src="${src}" alt="Código QR del enlace para el árbitro" width="160" height="160">`;
    } catch { /* sin QR, queda el enlace */ }
  }

  panelNube.addEventListener('click', async (e) => {
    const id = e.target.id;
    if (id === 'nubeSinc') { await sinc?.sincronizar(); pintarNube(); }
    if (id === 'nubeSubir') {
      e.target.disabled = true;
      const n = await sinc.subirFichasDelMovil();
      aviso(`${n} ${n === 1 ? 'ficha subida' : 'fichas subidas'} a ${equipoSinc.nombre}.`);
      pintarNube();
    }
    if (id === 'nubeEnlace') {
      e.target.disabled = true;
      e.target.textContent = 'Creando enlace…';
      try {
        await sinc.crearEnlaceArbitro();
        await pintarNube();
        aviso('Enlace creado. Compártelo con el árbitro o enséñale el código QR.');
      } catch (err) {
        aviso(err.message);
        pintarNube();
      }
    }
    if (id === 'nubeCopiar') {
      const campo = panelNube.querySelector('#nubeEnlaceUrl');
      try { await navigator.clipboard.writeText(campo.value); aviso('Enlace copiado.'); } catch { campo.select(); aviso('Selecciona el enlace y cópialo.'); }
    }
    if (id === 'nubeCompartir') {
      const url = panelNube.querySelector('#nubeEnlaceUrl').value;
      try { await navigator.share({ title: `Fichas · ${equipoSinc.nombre}`, url }); } catch { /* cancelado */ }
    }
    if (id === 'nubeAnular') {
      const b = e.target;
      if (!b.classList.contains('confirmar')) {
        b.classList.add('confirmar'); b.textContent = '¿Anular? Toca otra vez';
        setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Anular enlace'; }, 3000);
        return;
      }
      try {
        await sinc.anularEnlaceArbitro();
        aviso('Enlace anulado: el árbitro ya no puede ver las fichas con él.');
      } catch (err) {
        aviso(`No se ha podido anular: ${err.message}`);
      }
      pintarNube();
    }
  });

  // ---------------------------------------------------------------- Sección y botón de navegación
  const boton = document.createElement('button');
  boton.dataset.seccion = 'club';
  boton.textContent = 'Club';
  document.getElementById('secciones').appendChild(boton);

  const seccion = document.createElement('section');
  seccion.className = 'seccion';
  seccion.id = 'appClub';
  seccion.hidden = true;
  seccion.innerHTML = '<div class="contenedor" id="clubCuerpo"></div>';
  document.getElementById('appPartido').after(seccion);

  const temporada = crearTemporada(sb, {
    equipoActivo: () => equipoSinc,
    partidoActualId: () => window.FichasApp?.partido()?.partidoId || null,
  });
  // Copia de seguridad y fin de temporada (en la sección Club)
  let pausado = null;
  const fin = crearFinTemporada(sb, {
    aviso,
    equipoActivo: () => equipoSinc,
    pendientes: () => sinc?.pendientes() || 0,
    // Durante el borrado no se sincroniza (si no, se volverían a subir las fichas del móvil)
    async pararSinc() { pausado = equipoSinc; await activarEquipo(null); },
    async reanudarSinc() { const eq = pausado; pausado = null; if (eq && S.sesion) await activarEquipo(eq); },
  });

  const guardada = window.seccionGuardada?.();
  if (guardada === 'club' || guardada === 'temporada') window.mostrarSeccion(guardada);

  const cuerpo = seccion.querySelector('#clubCuerpo');

  // ---------------------------------------------------------------- Carga de datos
  async function cargar() {
    if (!S.sesion) return pintar();
    if (!S.aceptadas) {
      S.aceptadas = true; // antes del await: evita aceptar dos veces si llegan dos eventos de sesión seguidos
      const { data: n, error } = await sb.rpc('aceptar_invitaciones');
      if (error) S.aceptadas = false;
      else if (n > 0) aviso(n === 1 ? 'Invitación aceptada.' : `${n} invitaciones aceptadas.`);
    }
    const uid = S.sesion.user.id;
    const [eq, mc, me] = await Promise.all([
      sb.from('equipos').select('id, club_id, nombre, categoria, modalidad, genero, temporadas(nombre, activa)').order('nombre'),
      sb.from('miembros_club').select('club_id').eq('user_id', uid),
      sb.from('miembros_equipo').select('equipo_id, rol').eq('user_id', uid),
    ]);
    if (eq.error || mc.error || me.error) {
      cuerpo.innerHTML = `<div class="aviso-bd">No se han podido cargar los datos del club: ${esc((eq.error || mc.error || me.error).message)}</div>`;
      return;
    }
    const rolDe = Object.fromEntries((me.data || []).map((m) => [m.equipo_id, m.rol]));
    S.adminDe = (mc.data || []).map((m) => m.club_id);
    S.equipos = (eq.data || []).map((e) => ({ ...e, rol: rolDe[e.id] || (S.adminDe.includes(e.club_id) ? 'admin' : '') }));
    const idsClub = [...new Set([...S.adminDe, ...S.equipos.map((e) => e.club_id)])];
    if (idsClub.length) {
      const { data } = await sb.from('clubes').select('id, nombre').in('id', idsClub);
      S.clubes = Object.fromEntries((data || []).map((c) => [c.id, c.nombre]));
    }
    if (S.adminDe.length) {
      const [inv, mie] = await Promise.all([
        sb.from('invitaciones').select('id, club_id, equipo_id, email, rol, aceptada_en').is('aceptada_en', null).order('creada_en'),
        sb.from('miembros_equipo').select('equipo_id, user_id, email, rol'),
      ]);
      S.invitaciones = inv.data || [];
      S.miembros = mie.data || [];
    }
    if (!S.equipos.some((e) => e.id === leer(CLAVE_EQUIPO)) && S.equipos[0]) escribir(CLAVE_EQUIPO, S.equipos[0].id);
    pintar();
    activarEquipo(S.equipos.find((e) => e.id === leer(CLAVE_EQUIPO)) || null);
  }

  // ---------------------------------------------------------------- Pintado
  function pintar() {
    if (!S.sesion) { pintarAcceso(); return; }
    const activo = leer(CLAVE_EQUIPO);
    const email = S.sesion.user.email;
    let h = `<div class="cab"><div><h1>Club</h1><p class="nota">Has entrado como <strong>${esc(email)}</strong>.</p></div>
      <button class="btn" id="clubSalir">Salir</button></div>`;

    h += '<h2>Mis equipos</h2>';
    if (!S.equipos.length) {
      h += `<div class="f-vacio"><strong>Todavía no tienes equipos</strong>
        <p>Pide a la coordinación del club que te invite con este email (${esc(email)}). Cuando lo haga, vuelve a entrar.</p></div>`;
    } else {
      h += '<div class="club-equipos">' + S.equipos.map((e) => `
        <article class="club-equipo${e.id === activo ? ' activo' : ''}">
          <div><strong>${esc(e.nombre)}</strong>
            <div class="nota">${esc(MODALIDADES[e.modalidad])}${e.categoria ? ' · ' + esc(e.categoria) : ''}${e.temporadas?.nombre ? ' · ' + esc(e.temporadas.nombre) : ''}</div>
            <div class="nota">${esc(S.clubes[e.club_id] || '')} · ${esc(ROLES[e.rol] || '')}</div></div>
          ${e.id === activo ? '<span class="etq">Equipo activo</span>' : `<button class="btn" data-activar="${e.id}">Usar este equipo</button>`}
        </article>`).join('') + '</div>';
      h += '<p class="nota">Las fichas, la convocatoria y los goles del <strong>equipo activo</strong> se comparten con el resto de delegados y entrenadores del equipo. Sin cobertura se guardan en el móvil y se suben al volver la conexión.</p>';
    }

    const eqActivo = S.equipos.find((e) => e.id === activo);
    if (eqActivo) h += fin.html(eqActivo, S.adminDe.includes(eqActivo.club_id));

    for (const clubId of S.adminDe) h += pintarAdmin(clubId);
    const finAbierto = cuerpo.querySelector('#clubFin')?.open;
    cuerpo.innerHTML = h;
    if (finAbierto && cuerpo.querySelector('#clubFin')) cuerpo.querySelector('#clubFin').open = true;
  }

  function pintarAdmin(clubId) {
    const equipos = S.equipos.filter((e) => e.club_id === clubId);
    const nombreEq = (id) => equipos.find((e) => e.id === id)?.nombre || 'Administración del club';
    let h = `<h2>Administración · ${esc(S.clubes[clubId] || 'Club')}</h2>`;

    h += `<form class="club-form" data-club="${clubId}" data-form="equipo">
      <strong>Crear equipo</strong>
      <div class="club-campos">
        <input class="entrada" name="nombre" id="eqNombre-${clubId}" placeholder="Nombre (p. ej. Alevín A)" required>
        <select name="categoria" id="eqCategoria-${clubId}">${CATEGORIAS.map((c) => `<option>${c}</option>`).join('')}</select>
        <select name="modalidad" id="eqModalidad-${clubId}">${Object.entries(MODALIDADES).map(([k, v]) => `<option value="${k}"${k === 'f7' ? ' selected' : ''}>${v}</option>`).join('')}</select>
        <select name="genero" id="eqGenero-${clubId}"><option value="femenino">Femenino</option><option value="masculino">Masculino</option><option value="mixto">Mixto</option></select>
      </div>
      <button class="btn primario">Crear equipo</button>
    </form>`;

    h += `<form class="club-form" data-club="${clubId}" data-form="invitar">
      <strong>Invitar a una persona</strong>
      <p class="nota">Cuando entre en la app con este email, quedará dada de alta en el equipo.</p>
      <div class="club-campos">
        <input class="entrada" type="email" name="email" id="invEmail-${clubId}" placeholder="email@ejemplo.com" required>
        <select name="equipo" id="invEquipo-${clubId}">${equipos.map((e) => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}<option value="">Administración del club</option></select>
        <select name="rol" id="invRol-${clubId}"><option value="delegado">Delegado/a</option><option value="entrenador">Entrenador/a</option></select>
      </div>
      <button class="btn primario">Enviar invitación</button>
    </form>`;

    const pend = S.invitaciones.filter((i) => i.club_id === clubId);
    if (pend.length) {
      h += '<strong>Invitaciones pendientes</strong><div class="club-lista">' + pend.map((i) => `
        <div class="club-fila"><span>${esc(i.email)}</span><span class="nota">${esc(nombreEq(i.equipo_id))} · ${esc(ROLES[i.rol])}</span>
        <button class="btn" data-borrar-inv="${i.id}">Anular</button></div>`).join('') + '</div>';
    }

    for (const e of equipos) {
      const mie = S.miembros.filter((m) => m.equipo_id === e.id);
      h += `<strong>${esc(e.nombre)}</strong><div class="club-lista">` + (mie.length
        ? mie.map((m) => `<div class="club-fila"><span>${esc(m.email || 'Sin email')}</span><span class="nota">${esc(ROLES[m.rol])}</span>
            <button class="btn" data-quitar="${e.id}|${m.user_id}">Quitar</button></div>`).join('')
        : '<p class="nota">Sin delegados ni entrenadores todavía.</p>') + '</div>';
    }
    return h;
  }

  function pintarAcceso(enviado) {
    cuerpo.innerHTML = `
      <div class="cab"><div><h1>Club</h1>
        <p class="nota">Entra con tu email para ver los equipos de tu club. No hace falta contraseña: te llega un enlace al correo.</p></div></div>
      <form class="club-form" id="formAcceso">
        <input class="entrada" type="email" id="accesoEmail" placeholder="tu-email@ejemplo.com" required autocomplete="email">
        <button class="btn primario grande">Enviarme el enlace</button>
      </form>
      ${enviado ? `<div class="club-form">
        <p>Te hemos enviado un correo a <strong>${esc(enviado)}</strong>. Ábrelo en este mismo móvil y pulsa el enlace.</p>
        <p class="nota">Si lo abres en otro sitio, escribe aquí el código que trae el correo:</p>
        <div class="club-campos"><input class="entrada" id="accesoCodigo" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Código del correo">
        <button class="btn" id="accesoVerificar" data-email="${esc(enviado)}">Entrar con el código</button></div>
      </div>` : ''}`;
  }

  // ---------------------------------------------------------------- Acciones
  cuerpo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'formAcceso') {
      const email = f.querySelector('#accesoEmail').value.trim().toLowerCase();
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) aviso(`No se ha podido enviar el correo: ${error.message}`);
      else pintarAcceso(email);
      return;
    }
    const club = f.dataset.club;
    const datos = Object.fromEntries(new FormData(f));
    if (f.dataset.form === 'equipo') {
      const { data: t } = await sb.from('temporadas').select('id').eq('club_id', club).eq('activa', true).limit(1).maybeSingle();
      if (!t) { aviso('El club no tiene una temporada activa.'); return; }
      const { error } = await sb.from('equipos').insert({ club_id: club, temporada_id: t.id, nombre: datos.nombre.trim(), categoria: datos.categoria, modalidad: datos.modalidad, genero: datos.genero });
      aviso(error ? `No se ha podido crear el equipo: ${error.message}` : `Equipo «${datos.nombre.trim()}» creado.`);
    }
    if (f.dataset.form === 'invitar') {
      const admin = !datos.equipo;
      const { error } = await sb.from('invitaciones').insert({
        club_id: club, equipo_id: admin ? null : datos.equipo, email: datos.email.trim().toLowerCase(), rol: admin ? 'admin' : datos.rol,
      });
      aviso(error ? `No se ha podido invitar: ${error.message}` : `Invitación creada para ${datos.email.trim()}. Avísale de que entre en la app con ese email.`);
    }
    cargar();
  });

  cuerpo.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-fin]')) { await fin.manejar(e); return; }
    if (t.id === 'clubSalir') { await sb.auth.signOut(); return; }
    if (t.id === 'accesoVerificar') {
      const token = cuerpo.querySelector('#accesoCodigo').value.replace(/\D/g, '');
      const { error } = await sb.auth.verifyOtp({ email: t.dataset.email, token, type: 'email' });
      if (error) aviso(`El código no es válido: ${error.message}`);
      return;
    }
    if (t.dataset.activar) {
      escribir(CLAVE_EQUIPO, t.dataset.activar);
      pintar();
      await activarEquipo(S.equipos.find((x) => x.id === t.dataset.activar));
      aviso('Equipo activo cambiado: las fichas y el partido son ahora los de este equipo.');
      return;
    }
    if (t.dataset.borrarInv) {
      const { error } = await sb.from('invitaciones').delete().eq('id', t.dataset.borrarInv);
      if (error) aviso(error.message);
      cargar();
      return;
    }
    if (t.dataset.quitar) {
      if (!t.classList.contains('confirmar')) {
        t.classList.add('confirmar'); t.textContent = '¿Seguro?';
        setTimeout(() => { t.classList.remove('confirmar'); t.textContent = 'Quitar'; }, 3000);
        return;
      }
      const [equipo, user] = t.dataset.quitar.split('|');
      const { error } = await sb.from('miembros_equipo').delete().eq('equipo_id', equipo).eq('user_id', user);
      if (error) aviso(error.message);
      cargar();
    }
  });

  // ---------------------------------------------------------------- Sesión
  sb.auth.onAuthStateChange((evento, sesion) => {
    const antes = S.sesion?.user?.id;
    S.sesion = sesion;
    if (evento === 'SIGNED_OUT') { S.aceptadas = false; S.equipos = []; S.adminDe = []; pintar(); activarEquipo(null); return; }
    if (sesion && sesion.user.id !== antes) {
      // Tras volver del enlace del correo, limpiar el código de acceso de la barra de direcciones
      if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname);
      setTimeout(cargar, 0);
    }
    if (!sesion) pintar();
  });
}
