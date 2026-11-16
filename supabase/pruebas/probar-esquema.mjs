// Prueba el esquema y los permisos (RLS) en un Postgres local (PGlite), sin tocar Supabase.
// Uso: npm run test:bd
// Simula lo mínimo de Supabase (roles anon/authenticated, auth.uid(), auth.jwt(), storage)
// y comprueba qué puede ver y hacer cada tipo de usuario.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();
let fallos = 0;
let ok = 0;

function comprobar(cond, texto) {
  if (cond) { ok++; console.log('  ✔', texto); } else { fallos++; console.log('  ✘', texto); }
}

// --- Simulación mínima de Supabase
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`);

const carpeta = join(aqui, '..', 'migrations');
for (const m of readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(join(carpeta, m), 'utf8'));
await db.exec(readFileSync(join(aqui, '..', 'semilla.sql'), 'utf8').replace('cambia-esto@ejemplo.com', 'admin@prueba.es'));

// --- Usuarios de prueba
const U = {
  admin: { id: '00000000-0000-0000-0000-00000000000a', email: 'admin@prueba.es' },
  delegada: { id: '00000000-0000-0000-0000-00000000000b', email: 'delegada@prueba.es' },
  otra: { id: '00000000-0000-0000-0000-00000000000c', email: 'otra@prueba.es' },
  extrana: { id: '00000000-0000-0000-0000-00000000000d', email: 'extrana@prueba.es' },
};
for (const u of Object.values(U)) await db.query('insert into auth.users values ($1, $2)', [u.id, u.email]);

async function como(u) {
  await db.exec('reset role');
  if (!u) {
    await db.query("select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)");
    await db.exec('set role anon');
    return;
  }
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)",
    [u.id, JSON.stringify({ sub: u.id, email: u.email, role: 'authenticated' })]);
  await db.exec('set role authenticated');
}
const filas = async (sql, p = []) => (await db.query(sql, p)).rows;
async function falla(sql, p = []) {
  try { await db.query(sql, p); return false; } catch { return true; }
}

async function escenario() {
// --- 1. Administrador del club
console.log('\n1. Administrador del club');
await como(U.admin);
comprobar((await filas('select public.aceptar_invitaciones() n'))[0].n === 1, 'acepta su invitación de administrador');
const [club] = await filas('select id, nombre from clubes');
comprobar(club?.nombre === 'Vandalia de Peligros', 've su club');
const [temp] = await filas('select id from temporadas where activa');
const [alevin] = await filas("insert into equipos (club_id, temporada_id, nombre, categoria, modalidad, genero) values ($1, $2, 'Alevín A', 'alevín', 'f7', 'femenino') returning id", [club.id, temp.id]);
const [infantil] = await filas("insert into equipos (club_id, temporada_id, nombre, categoria, modalidad, genero) values ($1, $2, 'Infantil B', 'infantil', 'f11', 'femenino') returning id", [club.id, temp.id]);
comprobar(!!alevin && !!infantil, 'crea dos equipos');
await filas("insert into invitaciones (club_id, equipo_id, email, rol) values ($1, $2, 'delegada@prueba.es', 'delegado')", [club.id, alevin.id]);
await filas("insert into invitaciones (club_id, equipo_id, email, rol) values ($1, $2, 'otra@prueba.es', 'entrenador')", [club.id, infantil.id]);
comprobar((await filas('select count(*)::int n from invitaciones where aceptada_en is null'))[0].n === 2, 'invita a una delegada y a una entrenadora');

// --- 2. Delegada del Alevín A
console.log('\n2. Delegada del Alevín A');
await como(U.delegada);
comprobar((await filas('select public.aceptar_invitaciones() n'))[0].n === 1, 'acepta su invitación');
const equiposDelegada = await filas('select nombre from equipos');
comprobar(equiposDelegada.length === 1 && equiposDelegada[0].nombre === 'Alevín A', 'solo ve el Alevín A');
comprobar((await filas('select count(*)::int n from invitaciones'))[0].n === 0, 'no ve las invitaciones del club');
const [jug] = await filas("insert into jugadoras (club_id, nombre) values ($1, 'Lucia') returning id", [club.id]);
comprobar((await filas("update jugadoras set nombre = 'Lucía' where id = $1 returning id", [jug.id])).length === 1, 'corrige el nombre de una jugadora recién creada');
const [ficha] = await filas("insert into fichas (equipo_id, jugadora_id, dorsal, foto_path) values ($1, $2, '7', $3) returning id", [alevin.id, jug.id, `${alevin.id}/lucia.jpg`]);
comprobar(!!ficha, 'crea una jugadora y su ficha en su equipo');
comprobar(await falla("insert into fichas (equipo_id, jugadora_id, dorsal) values ($1, $2, '9')", [infantil.id, jug.id]), 'NO puede crear fichas en otro equipo');
comprobar(await falla("insert into invitaciones (club_id, equipo_id, email, rol) values ($1, $2, 'x@prueba.es', 'delegado')", [club.id, alevin.id]), 'NO puede invitar (solo el administrador)');
comprobar(await falla("insert into equipos (club_id, temporada_id, nombre, modalidad) values ($1, $2, 'Pirata', 'f7')", [club.id, temp.id]), 'NO puede crear equipos');
const [partido] = await filas("insert into partidos (equipo_id, rival, fecha) values ($1, 'CD Ejemplo', now()) returning id", [alevin.id]);
await filas("insert into convocatorias (partido_id, ficha_id, dorsal_partido, titular) values ($1, $2, '14', true)", [partido.id, ficha.id]);
// Cuerpo técnico: entrenadora en prácticas con foto del DNI, sin dorsal
const [pers] = await filas("insert into jugadoras (club_id, nombre) values ($1, 'Marta (prácticas)') returning id", [club.id]);
const [fStaff] = await filas("insert into fichas (equipo_id, jugadora_id, tipo, cargo) values ($1, $2, 'staff', 'practicas') returning id", [alevin.id, pers.id]);
comprobar(!!fStaff, 'crea la ficha de una entrenadora en prácticas (sin dorsal)');
comprobar(await falla("insert into fichas (equipo_id, jugadora_id, tipo, cargo) values ($1, $2, 'staff', 'presidente')", [alevin.id, jug.id]), 'NO acepta un cargo desconocido');
await filas("insert into convocatorias (partido_id, ficha_id, titular) values ($1, $2, true)", [partido.id, fStaff.id]);
await filas("insert into eventos (partido_id, tipo, ficha_id, minuto) values ($1, 'gol', $2, 12)", [partido.id, ficha.id]);
await filas("insert into eventos (partido_id, tipo, minuto) values ($1, 'gol_rival', 20)", [partido.id]);
comprobar((await filas('select count(*)::int n from eventos'))[0].n === 2, 'crea partido, convocatoria y goles');
await filas("update partidos set lugar = 'Campo Municipal', cita = '09:15', es_local = true, notas = 'Equipación azul' where id = $1", [partido.id]);
comprobar((await filas('select cita from partidos where id = $1', [partido.id]))[0].cita === '09:15', 'guarda campo, citación, casa/fuera y qué llevar');
comprobar(await falla("update partidos set cita = '25:99' where id = $1", [partido.id]), 'NO acepta una hora de citación imposible');
// Cambios, tarjetas y minutos
const [jug2] = await filas("insert into jugadoras (club_id, nombre) values ($1, 'Sara') returning id", [club.id]);
const [ficha2] = await filas("insert into fichas (equipo_id, jugadora_id, dorsal) values ($1, $2, '10') returning id", [alevin.id, jug2.id]);
await filas("insert into convocatorias (partido_id, ficha_id) values ($1, $2)", [partido.id, ficha2.id]);
await filas("insert into eventos (partido_id, tipo, ficha_id, ficha_entra, minuto, parte, segundo) values ($1, 'cambio', $2, $3, 18, 1, 1050)", [partido.id, ficha.id, ficha2.id]);
await filas("insert into eventos (partido_id, tipo, ficha_id, minuto, parte, segundo) values ($1, 'amarilla', $2, 22, 1, 1300)", [partido.id, ficha2.id]);
comprobar((await filas("select count(*)::int n from eventos where tipo in ('cambio', 'amarilla')"))[0].n === 2, 'apunta un cambio y una tarjeta');
comprobar(await falla("insert into eventos (partido_id, tipo, ficha_id, ficha_entra) values ($1, 'amarilla', $2, $3)", [partido.id, ficha.id, ficha2.id]), 'NO acepta «entra» en algo que no es un cambio');
await filas('update convocatorias set segundos_jugados = 1050 where partido_id = $1 and ficha_id = $2', [partido.id, ficha.id]);
comprobar((await filas('select segundos_jugados s from convocatorias where partido_id = $1 and ficha_id = $2', [partido.id, ficha.id]))[0].s === 1050, 'guarda los segundos jugados de cada convocada');
const [enlace] = await filas('insert into enlaces_arbitro (partido_id, fotos) values ($1, $2) returning token', [partido.id, JSON.stringify({ [ficha.id]: 'https://firmada.example/lucia.jpg' })]);
comprobar(enlace?.token?.length === 64, 'crea un enlace para el árbitro con código de 64 caracteres');
await filas("insert into storage.objects (bucket_id, name) values ('fichas', $1)", [`${alevin.id}/lucia.jpg`]);
comprobar(await falla("insert into storage.objects (bucket_id, name) values ('fichas', $1)", [`${infantil.id}/intrusa.jpg`]), 'NO puede subir fotos a la carpeta de otro equipo');
comprobar(await falla("insert into storage.objects (bucket_id, name) values ('fichas', 'no-es-un-equipo/x.jpg')"), 'NO puede subir fotos a rutas inválidas');
await filas("insert into jugadas (club_id, titulo, modalidad, doc, compartida_club) values ($1, 'Córner del Alevín', 'f7', '{}', true)", [club.id]);
await filas("insert into jugadas (club_id, titulo, modalidad, doc) values ($1, 'Jugada privada', 'f7', '{}')", [club.id]);

// --- 3. Entrenadora del Infantil B
console.log('\n3. Entrenadora del Infantil B');
await como(U.otra);
await filas('select public.aceptar_invitaciones()');
comprobar((await filas('select nombre from equipos')).map((e) => e.nombre).join() === 'Infantil B', 'solo ve el Infantil B');
comprobar((await filas('select count(*)::int n from jugadoras'))[0].n === 0, 'no ve las jugadoras del Alevín A');
comprobar((await filas('select count(*)::int n from storage.objects'))[0].n === 0, 'no ve las fotos del Alevín A');
comprobar((await filas('select count(*)::int n from partidos'))[0].n === 0, 'no ve los partidos del Alevín A');
const jugadasOtra = await filas('select titulo from jugadas');
comprobar(jugadasOtra.length === 1 && jugadasOtra[0].titulo === 'Córner del Alevín', 've la jugada compartida con el club, no la privada');
comprobar((await filas("update fichas set dorsal = '99' returning id")).length === 0, 'NO puede modificar fichas de otro equipo');

// --- 4. Usuaria sin invitación
console.log('\n4. Usuaria registrada sin invitación');
await como(U.extrana);
comprobar((await filas('select public.aceptar_invitaciones() n'))[0].n === 0, 'no tiene invitaciones');
comprobar((await filas('select count(*)::int n from clubes'))[0].n === 0, 'no ve el club');
comprobar((await filas('select count(*)::int n from equipos'))[0].n === 0, 'no ve equipos');
comprobar((await filas('select count(*)::int n from jugadas'))[0].n === 0, 'no ve jugadas');
comprobar(await falla("insert into jugadoras (club_id, nombre) values ($1, 'Colada')", [club.id]), 'NO puede crear jugadoras en el club');

// --- 5. Administrador ve todo su club
console.log('\n5. Administrador');
await como(U.admin);
comprobar((await filas('select count(*)::int n from equipos'))[0].n === 2, 've los dos equipos');
comprobar((await filas('select count(*)::int n from jugadoras'))[0].n === 3, 've a todas las personas del club (jugadoras y cuerpo técnico)');
comprobar((await filas('select count(*)::int n from miembros_equipo'))[0].n === 2, 've a los miembros de los equipos');
comprobar((await filas('select titulo from jugadas')).length === 1, 'no ve la jugada privada de la delegada (sí la compartida)');

// --- 6. Árbitro sin cuenta
console.log('\n6. Árbitro (sin sesión)');
await como(null);
const arb = await filas('select * from public.fichas_arbitro($1)', [enlace.token]);
comprobar(arb[0]?.tipo === 'jugadora' && arb[0].dorsal === '14' && arb[0].nombre === 'Lucía' && arb[0].titular === true, 've la convocada con el dorsal del día');
comprobar(arb[0]?.foto_url === 'https://firmada.example/lucia.jpg', 've la foto con el enlace temporal guardado');
comprobar(arb.length === 3 && arb[2].tipo === 'staff' && arb[2].cargo === 'practicas' && arb[2].dorsal === null && arb[2].titular === false,
  've a la entrenadora en prácticas después de las jugadoras, sin dorsal ni titular');
comprobar((await filas('select * from public.fichas_arbitro($1)', ['codigo-inventado'])).length === 0, 'con un código inventado no ve nada');
comprobar(await falla('select * from fichas'), 'NO puede leer las tablas directamente');
comprobar(await falla('select public.aceptar_invitaciones()'), 'NO puede aceptar invitaciones');
await como(U.delegada);
await filas("update enlaces_arbitro set valido_hasta = now() - interval '1 minute' where token = $1", [enlace.token]);
await como(null);
comprobar((await filas('select * from public.fichas_arbitro($1)', [enlace.token])).length === 0, 'con el enlace caducado no ve nada');
await como(U.delegada);
await filas("update enlaces_arbitro set valido_hasta = now() + interval '1 hour', revocado = true where token = $1", [enlace.token]);
await como(null);
comprobar((await filas('select * from public.fichas_arbitro($1)', [enlace.token])).length === 0, 'con el enlace revocado no ve nada');

console.log('\n7. Fin de temporada');
await como(U.delegada);
comprobar(await falla('select public.limpiar_jugadoras_sin_ficha($1)', [club.id]), 'la delegada NO puede limpiar las jugadoras del club');
await como(U.admin);
await filas("insert into jugadoras (club_id, nombre) values ($1, 'Sin ficha')", [club.id]);
comprobar((await filas('select public.limpiar_jugadoras_sin_ficha($1) n', [club.id]))[0].n === 1, 'borra solo la jugadora que no tiene ficha');
comprobar((await filas("select count(*)::int n from jugadoras where nombre = 'Lucía'"))[0].n === 1, 'Lucía sigue (tiene ficha)');
await filas('delete from partidos where equipo_id = $1', [alevin.id]);
await filas('delete from fichas where equipo_id = $1', [alevin.id]);
comprobar((await filas('select count(*)::int n from eventos'))[0].n === 0 && (await filas('select count(*)::int n from convocatorias'))[0].n === 0,
  'al borrar los partidos del equipo se borran convocatorias y eventos');
comprobar((await filas('select public.limpiar_jugadoras_sin_ficha($1) n', [club.id]))[0].n >= 2, 'después borra los nombres de las jugadoras del equipo');
comprobar((await filas('select count(*)::int n from jugadoras'))[0].n === 0, 'no queda ningún nombre de jugadora');

await db.exec('reset role');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
}

try {
  await escenario();
} catch (e) {
  console.error(`\n✘ Error inesperado: ${e.message}\n  en: ${e.query || ''}`);
  process.exit(1);
}
