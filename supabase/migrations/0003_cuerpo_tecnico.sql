-- =====================================================================
-- 0003 · Fichas del cuerpo técnico (entrenadores, delegados, en prácticas…)
-- Ejecutar en Supabase → SQL Editor después de 0002.
--
-- La tabla «jugadoras» guarda a las personas del club (jugadoras y cuerpo técnico).
-- Cada ficha indica si es de jugadora o de cuerpo técnico y, en ese caso, su cargo.
-- El cuerpo técnico no lleva dorsal ni es titular; la foto puede ser la licencia o el DNI.
-- =====================================================================

alter table public.fichas add column if not exists tipo text not null default 'jugadora';
alter table public.fichas add column if not exists cargo text;

alter table public.fichas drop constraint if exists fichas_tipo_check;
alter table public.fichas add constraint fichas_tipo_check check (tipo in ('jugadora', 'staff'));
alter table public.fichas drop constraint if exists fichas_cargo_check;
alter table public.fichas add constraint fichas_cargo_check check (
  (tipo = 'jugadora' and cargo is null)
  or (tipo = 'staff' and cargo in ('entrenador', 'segundo', 'delegado', 'practicas', 'auxiliar'))
);

comment on table public.jugadoras is 'Personas del club: jugadoras y cuerpo técnico';

-- El árbitro ve también al cuerpo técnico convocado, después de las jugadoras
drop function if exists public.fichas_arbitro(text);

create function public.fichas_arbitro(p_token text)
returns table (equipo text, rival text, fecha timestamptz, dorsal text, nombre text, titular boolean, foto_url text, tipo text, cargo text)
language sql stable security definer set search_path = public as $$
  select e.nombre, p.rival, p.fecha,
         case when f.tipo = 'staff' then null else coalesce(nullif(c.dorsal_partido, ''), f.dorsal) end,
         j.nombre,
         c.titular and f.tipo = 'jugadora',
         t.fotos ->> f.id::text,
         f.tipo, f.cargo
  from enlaces_arbitro t
  join partidos p        on p.id = t.partido_id
  join equipos e         on e.id = p.equipo_id
  join convocatorias c   on c.partido_id = p.id
  join fichas f          on f.id = c.ficha_id
  join jugadoras j       on j.id = f.jugadora_id
  where t.token = p_token and not t.revocado and now() < t.valido_hasta
  order by (f.tipo = 'staff'),
           c.titular desc,
           nullif(regexp_replace(coalesce(nullif(c.dorsal_partido, ''), f.dorsal, ''), '\D', '', 'g'), '')::integer nulls last,
           array_position(array['entrenador', 'segundo', 'delegado', 'practicas', 'auxiliar'], f.cargo),
           j.nombre;
$$;

revoke execute on function public.fichas_arbitro(text) from public;
grant execute on function public.fichas_arbitro(text) to anon, authenticated;
