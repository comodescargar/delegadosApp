-- =====================================================================
-- 0002 · Fotos en el enlace del árbitro y ajuste de permisos de jugadoras
-- Ejecutar en Supabase → SQL Editor después de 0001_esquema.sql.
-- =====================================================================

-- Al crear el enlace, el delegado genera enlaces temporales (firmados) a las fotos de las
-- convocadas y se guardan aquí. Así el árbitro, sin cuenta, ve las fotos solo mientras
-- el enlace es válido y sin necesidad de ninguna clave secreta en el servidor.
alter table public.enlaces_arbitro add column if not exists fotos jsonb not null default '{}'::jsonb;

drop function if exists public.fichas_arbitro(text);

create function public.fichas_arbitro(p_token text)
returns table (equipo text, rival text, fecha timestamptz, dorsal text, nombre text, titular boolean, foto_url text)
language sql stable security definer set search_path = public as $$
  select e.nombre, p.rival, p.fecha,
         coalesce(nullif(c.dorsal_partido, ''), f.dorsal),
         j.nombre, c.titular, t.fotos ->> f.id::text
  from enlaces_arbitro t
  join partidos p        on p.id = t.partido_id
  join equipos e         on e.id = p.equipo_id
  join convocatorias c   on c.partido_id = p.id
  join fichas f          on f.id = c.ficha_id
  join jugadoras j       on j.id = f.jugadora_id
  where t.token = p_token and not t.revocado and now() < t.valido_hasta
  order by c.titular desc,
           nullif(regexp_replace(coalesce(nullif(c.dorsal_partido, ''), f.dorsal, ''), '\D', '', 'g'), '')::integer nulls last,
           j.nombre;
$$;

revoke execute on function public.fichas_arbitro(text) from public;
grant execute on function public.fichas_arbitro(text) to anon, authenticated;

-- Quien crea una jugadora puede corregir su nombre aunque aún no tenga ficha.
drop policy if exists jugadoras_editar on public.jugadoras;
create policy jugadoras_editar on public.jugadoras for update to authenticated
  using (public.es_admin_club(club_id)
         or (creada_por = auth.uid() and public.es_miembro_club(club_id))
         or exists (select 1 from public.fichas f where f.jugadora_id = jugadoras.id and public.puede_ver_equipo(f.equipo_id)))
  with check (public.es_miembro_club(club_id));
