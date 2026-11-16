// Página del árbitro: /a/<código>. Sin cuenta. Solo muestra datos si el código es válido y no ha caducado.
import { createClient } from '@supabase/supabase-js';

const URL_SB = import.meta.env.VITE_SUPABASE_URL;
const CLAVE_SB = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function mostrarEstado(titulo, texto) {
  $('#sub').textContent = '';
  $('#contenido').innerHTML = `<div class="estado"><strong>${esc(titulo)}</strong>${esc(texto)}</div>`;
}

async function iniciar() {
  const token = (location.pathname.match(/\/a\/([0-9a-f]{20,})/i) || [])[1] || new URLSearchParams(location.search).get('t');
  if (!token) return mostrarEstado('Enlace incompleto', 'Pide al delegado que te vuelva a enviar el enlace.');
  if (!URL_SB || !CLAVE_SB) return mostrarEstado('No disponible', 'La aplicación no está conectada a la base de datos.');

  const sb = createClient(URL_SB, CLAVE_SB, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc('fichas_arbitro', { p_token: token });
  if (error) return mostrarEstado('No se han podido cargar las fichas', 'Comprueba la conexión y vuelve a abrir el enlace.');
  if (!data?.length) return mostrarEstado('Enlace no válido o caducado', 'Pide al delegado que cree un enlace nuevo desde la app.');

  const p = data[0];
  const fecha = p.fecha ? new Date(p.fecha).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  document.title = `Fichas · ${p.equipo}`;
  $('#titulo').textContent = p.rival ? `${p.equipo} · ${p.rival}` : p.equipo;
  $('#sub').textContent = [fecha, `${data.length} ${data.length === 1 ? 'convocada' : 'convocadas'}`].filter(Boolean).join(' · ');

  const CARGOS = { entrenador: 'Entrenador/a', segundo: '2º entrenador/a', delegado: 'Delegado/a', practicas: 'Entrenador/a en prácticas', auxiliar: 'Auxiliar' };
  const esStaff = (f) => f.tipo === 'staff';
  const tarjeta = (f) => `<button class="ficha" data-i="${data.indexOf(f)}">
      ${f.foto_url ? `<img src="${esc(f.foto_url)}" alt="Ficha de ${esc(f.nombre)}" loading="lazy">` : '<div class="sin"></div>'}
      <span>${esStaff(f) ? `${esc(f.nombre)}<i class="cargo">${esc(CARGOS[f.cargo] || 'Cuerpo técnico')}</i>` : `<b class="dorsal">${esc(f.dorsal || '–')}</b>${esc(f.nombre)}`}</span></button>`;
  const bloque = (titulo, lista) => (lista.length ? `${titulo ? `<h2>${titulo}</h2>` : ''}<div class="rejilla">${lista.map(tarjeta).join('')}</div>` : '');
  const jugadoras = data.filter((f) => !esStaff(f));
  const staff = data.filter(esStaff);
  const titulares = jugadoras.filter((f) => f.titular);
  $('#contenido').innerHTML = (titulares.length
    ? bloque('Titulares', titulares) + bloque('Suplentes', jugadoras.filter((f) => !f.titular))
    : bloque(staff.length ? 'Jugadoras' : '', jugadoras))
    + bloque('Cuerpo técnico', staff);
  $('#sub').textContent = [fecha, `${jugadoras.length} ${jugadoras.length === 1 ? 'convocada' : 'convocadas'}`,
    staff.length ? `${staff.length} de cuerpo técnico` : ''].filter(Boolean).join(' · ');

  $('#contenido').addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const f = data[Number(b.dataset.i)];
    if (!f.foto_url) return;
    $('#grandeImg').src = f.foto_url;
    $('#grandeTxt').textContent = esStaff(f) ? `${f.nombre} · ${CARGOS[f.cargo] || 'Cuerpo técnico'}` : `${f.dorsal || '–'} · ${f.nombre}`;
    $('#grande').hidden = false;
  });
  $('#cerrar').addEventListener('click', () => { $('#grande').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#grande').hidden = true; });
}

iniciar();
