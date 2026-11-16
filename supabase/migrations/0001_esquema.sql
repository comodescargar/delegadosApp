-- =====================================================================
-- Delegados App · Esquema inicial (versión 1)
-- Ejecutar en Supabase → SQL Editor (o con la CLI de Supabase).
--
-- Principios:
--   · Cada usuario solo ve los equipos de los que es miembro.
--   · Los administradores del club ven y gestionan todo su club.
--   · El árbitro no tiene cuenta: usa un enlace con código que caduca.
--   · Las fotos de las fichas van a un almacenamiento privado.
-- =====================================================================

-- ---------------------------------------------------------------- Tablas

create table public.clubes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  federacion  text,
  creado_en   timestamptz not null default now()
);

create table public.temporadas (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references public.clubes on delete cascade,
  nombre    text not null,                         -- p. ej. '2026/27'
  activa    boolean not null default false,
  unique (club_id, nombre)
);

create table public.equipos (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubes on delete cascade,
  temporada_id  uuid not null references public.temporadas on delete cascade,
  nombre        text not null,                     -- p. ej. 'Alevín A'
  categoria     text,                              -- prebenjamín, benjamín, alevín…
  modalidad     text not null check (modalidad in ('sala', 'f7', 'f11')),
  genero        text check (genero in ('femenino', 'masculino', 'mixto')),
  creado_en     timestamptz not null default now()
);

-- Administradores del club (coordinación, directiva)
create table public.miembros_club (
  club_id   uuid not null references public.clubes on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  email     text,
  rol       text not null default 'admin' check (rol in ('admin')),
  primary key (club_id, user_id)
);

-- Delegados/as y entrenadores/as de cada equipo
create table public.miembros_equipo (
  equipo_id  uuid not null references public.equipos on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  email      text,
  rol        text not null check (rol in ('delegado', 'entrenador')),
  primary key (equipo_id, user_id)
);

-- Invitaciones por email. Al entrar con ese email se convierten en membresías.
create table public.invitaciones (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubes on delete cascade,
  equipo_id    uuid references public.equipos on delete cascade,   -- null = administrador del club
  email        text not null check (email = lower(btrim(email)) and email like '%@%'),
  rol          text not null check (rol in ('admin', 'delegado', 'entrenador')),
  creada_por   uuid references auth.users on delete set null default auth.uid(),
  creada_en    timestamptz not null default now(),
  aceptada_en  timestamptz,
  check ((equipo_id is null) = (rol = 'admin'))
);

-- Personas (perduran entre temporadas). Datos mínimos: no se guarda DNI ni contacto.
create table public.jugadoras (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubes on delete cascade,
  nombre      text not null,
  apellidos   text,
  creada_por  uuid references auth.users on delete set null default auth.uid(),
  creada_en   timestamptz not null default now()
);

-- Ficha = jugadora en un equipo y temporada
create table public.fichas (
  id           uuid primary key default gen_random_uuid(),
  equipo_id    uuid not null references public.equipos on delete cascade,
  jugadora_id  uuid not null references public.jugadoras on delete cascade,
  dorsal       text,
  licencia     text,
  foto_path    text,                 -- ruta en el almacenamiento 'fichas': <equipo_id>/<archivo>
  activa       boolean not null default true,
  creada_en    timestamptz not null default now(),
  unique (equipo_id, jugadora_id)
);

create table public.partidos (
  id              uuid primary key default gen_random_uuid(),
  equipo_id       uuid not null references public.equipos on delete cascade,
  rival           text not null default '',
  fecha           timestamptz,
  lugar           text,
  minutos_parte   integer not null default 25 check (minutos_parte between 1 and 60),
  creado_en       timestamptz not null default now()
);

create table public.convocatorias (
  partido_id      uuid not null references public.partidos on delete cascade,
  ficha_id        uuid not null references public.fichas on delete cascade,
  dorsal_partido  text,              -- vacío = se usa el dorsal habitual de la ficha
  titular         boolean not null default false,
  primary key (partido_id, ficha_id)
);

create table public.eventos (
  id          uuid primary key default gen_random_uuid(),
  partido_id  uuid not null references public.partidos on delete cascade,
  tipo        text not null check (tipo in ('gol', 'gol_rival')),
  ficha_id    uuid references public.fichas on delete set null,
  minuto      integer check (minuto between 0 and 200),
  parte       integer not null default 1 check (parte between 1 and 4),
  creado_en   timestamptz not null default now(),
  check (tipo = 'gol' or ficha_id is null)
);

-- Jugadas y ejercicios propios (la biblioteca precargada va en el código de la app)
create table public.jugadas (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubes on delete cascade,
  equipo_id        uuid references public.equipos on delete cascade,
  autor            uuid references auth.users on delete set null default auth.uid(),
  titulo           text not null,
  modalidad        text not null check (modalidad in ('sala', 'f7', 'f11')),
  categoria        text,
  doc              jsonb not null,
  compartida_club  boolean not null default false,
  creada_en        timestamptz not null default now(),
  actualizada_en   timestamptz not null default now()
);

-- Enlace temporal para que el árbitro vea las fichas de un partido
create table public.enlaces_arbitro (
  token         text primary key
                default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  partido_id    uuid not null references public.partidos on delete cascade,
  valido_hasta  timestamptz not null default now() + interval '8 hours',
  revocado      boolean not null default false,
  creado_por    uuid references auth.users on delete set null default auth.uid(),
  creado_en     timestamptz not null default now()
);

-- Índices para las comprobaciones de permisos y búsquedas habituales
create index on public.temporadas (club_id);
create index on public.equipos (club_id);
create index on public.miembros_club (user_id);
create index on public.miembros_equipo (user_id);
create index on public.invitaciones (email) where aceptada_en is null;
create index on public.jugadoras (club_id);
create index on public.fichas (equipo_id);
create index on public.fichas (jugadora_id);
create index on public.partidos (equipo_id);
create index on public.eventos (partido_id);
create index on public.jugadas (club_id);
create index on public.enlaces_arbitro (partido_id);

-- ---------------------------------------------------------------- Funciones de permisos
-- security definer: consultan las membresías sin quedar bloqueadas por las propias políticas.

create function public.es_admin_club(p_club uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros_club where club_id = p_club and user_id = auth.uid());
$$;

-- Admin del club o miembro de algún equipo del club
create function public.es_miembro_club(p_club uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin_club(p_club)
      or exists (select 1 from miembros_equipo me join equipos e on e.id = me.equipo_id
                 where e.club_id = p_club and me.user_id = auth.uid());
$$;

-- Miembro del equipo o admin de su club
create function public.puede_ver_equipo(p_equipo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros_equipo where equipo_id = p_equipo and user_id = auth.uid())
      or exists (select 1 from equipos e join miembros_club m on m.club_id = e.club_id
                 where e.id = p_equipo and m.user_id = auth.uid());
$$;

create function public.es_admin_de_equipo(p_equipo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipos e join miembros_club m on m.club_id = e.club_id
                 where e.id = p_equipo and m.user_id = auth.uid());
$$;

create function public.puede_ver_partido(p_partido uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from partidos where id = p_partido and public.puede_ver_equipo(equipo_id));
$$;

-- La jugadora es del mismo club que el equipo
create function public.mismo_club(p_jugadora uuid, p_equipo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jugadoras j join equipos e on e.club_id = j.club_id
                 where j.id = p_jugadora and e.id = p_equipo);
$$;

-- La ficha pertenece al equipo del partido
create function public.ficha_del_partido(p_ficha uuid, p_partido uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_ficha is null
      or exists (select 1 from fichas f join partidos p on p.equipo_id = f.equipo_id
                 where f.id = p_ficha and p.id = p_partido);
$$;

create function public.uuid_o_null(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------- Permisos por fila (RLS)

alter table public.clubes            enable row level security;
alter table public.temporadas        enable row level security;
alter table public.equipos           enable row level security;
alter table public.miembros_club     enable row level security;
alter table public.miembros_equipo   enable row level security;
alter table public.invitaciones      enable row level security;
alter table public.jugadoras         enable row level security;
alter table public.fichas            enable row level security;
alter table public.partidos          enable row level security;
alter table public.convocatorias     enable row level security;
alter table public.eventos           enable row level security;
alter table public.jugadas           enable row level security;
alter table public.enlaces_arbitro   enable row level security;

-- Clubes: los ven sus miembros; solo los administradores los modifican.
-- (Los clubes se crean desde el panel de Supabase; ver semilla.sql.)
create policy clubes_ver on public.clubes for select to authenticated using (public.es_miembro_club(id));
create policy clubes_editar on public.clubes for update to authenticated
  using (public.es_admin_club(id)) with check (public.es_admin_club(id));

create policy temporadas_ver on public.temporadas for select to authenticated using (public.es_miembro_club(club_id));
create policy temporadas_admin on public.temporadas for all to authenticated
  using (public.es_admin_club(club_id)) with check (public.es_admin_club(club_id));

create policy equipos_ver on public.equipos for select to authenticated using (public.puede_ver_equipo(id));
create policy equipos_admin on public.equipos for all to authenticated
  using (public.es_admin_club(club_id))
  with check (public.es_admin_club(club_id)
              and exists (select 1 from public.temporadas t where t.id = temporada_id and t.club_id = equipos.club_id));

create policy miembros_club_ver on public.miembros_club for select to authenticated using (public.es_miembro_club(club_id));
create policy miembros_club_admin on public.miembros_club for all to authenticated
  using (public.es_admin_club(club_id)) with check (public.es_admin_club(club_id));

create policy miembros_equipo_ver on public.miembros_equipo for select to authenticated using (public.puede_ver_equipo(equipo_id));
create policy miembros_equipo_admin on public.miembros_equipo for all to authenticated
  using (public.es_admin_de_equipo(equipo_id)) with check (public.es_admin_de_equipo(equipo_id));

create policy invitaciones_admin on public.invitaciones for all to authenticated
  using (public.es_admin_club(club_id))
  with check (public.es_admin_club(club_id)
              and (equipo_id is null
                   or exists (select 1 from public.equipos e where e.id = equipo_id and e.club_id = invitaciones.club_id)));

-- Jugadoras: el admin ve todas; los demás, las que tienen ficha en sus equipos
-- y las que han creado ellos mismos (recién creadas aún no tienen ficha).
create policy jugadoras_ver on public.jugadoras for select to authenticated
  using (public.es_admin_club(club_id)
         or (creada_por = auth.uid() and public.es_miembro_club(club_id))
         or exists (select 1 from public.fichas f where f.jugadora_id = jugadoras.id and public.puede_ver_equipo(f.equipo_id)));
create policy jugadoras_crear on public.jugadoras for insert to authenticated
  with check (public.es_miembro_club(club_id));
create policy jugadoras_editar on public.jugadoras for update to authenticated
  using (public.es_admin_club(club_id)
         or exists (select 1 from public.fichas f where f.jugadora_id = jugadoras.id and public.puede_ver_equipo(f.equipo_id)))
  with check (public.es_miembro_club(club_id));
create policy jugadoras_borrar on public.jugadoras for delete to authenticated using (public.es_admin_club(club_id));

create policy fichas_equipo on public.fichas for all to authenticated
  using (public.puede_ver_equipo(equipo_id))
  with check (public.puede_ver_equipo(equipo_id) and public.mismo_club(jugadora_id, equipo_id));

create policy partidos_equipo on public.partidos for all to authenticated
  using (public.puede_ver_equipo(equipo_id)) with check (public.puede_ver_equipo(equipo_id));

create policy convocatorias_equipo on public.convocatorias for all to authenticated
  using (public.puede_ver_partido(partido_id))
  with check (public.puede_ver_partido(partido_id) and public.ficha_del_partido(ficha_id, partido_id));

create policy eventos_equipo on public.eventos for all to authenticated
  using (public.puede_ver_partido(partido_id))
  with check (public.puede_ver_partido(partido_id) and public.ficha_del_partido(ficha_id, partido_id));

create policy enlaces_equipo on public.enlaces_arbitro for all to authenticated
  using (public.puede_ver_partido(partido_id)) with check (public.puede_ver_partido(partido_id));

-- Jugadas: propias, del equipo o compartidas con el club
create policy jugadas_ver on public.jugadas for select to authenticated
  using (autor = auth.uid()
         or (equipo_id is not null and public.puede_ver_equipo(equipo_id))
         or (compartida_club and public.es_miembro_club(club_id)));
create policy jugadas_crear on public.jugadas for insert to authenticated
  with check (autor = auth.uid() and public.es_miembro_club(club_id)
              and (equipo_id is null or public.puede_ver_equipo(equipo_id)));
create policy jugadas_editar on public.jugadas for update to authenticated
  using (autor = auth.uid() or public.es_admin_club(club_id))
  with check (public.es_miembro_club(club_id) and (equipo_id is null or public.puede_ver_equipo(equipo_id)));
create policy jugadas_borrar on public.jugadas for delete to authenticated
  using (autor = auth.uid() or public.es_admin_club(club_id));

-- Los usuarios sin sesión no acceden a ninguna tabla (el árbitro usa fichas_arbitro()).
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------- Funciones para la app

-- Al entrar, convierte las invitaciones pendientes de ese email en membresías.
create function public.aceptar_invitaciones() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_n     integer := 0;
  r       record;
begin
  if v_uid is null or v_email = '' then
    return 0;
  end if;
  for r in select * from invitaciones where email = v_email and aceptada_en is null loop
    if r.equipo_id is null then
      insert into miembros_club (club_id, user_id, email, rol)
      values (r.club_id, v_uid, v_email, 'admin')
      on conflict (club_id, user_id) do nothing;
    else
      insert into miembros_equipo (equipo_id, user_id, email, rol)
      values (r.equipo_id, v_uid, v_email, r.rol)
      on conflict (equipo_id, user_id) do update set rol = excluded.rol;
    end if;
    update invitaciones set aceptada_en = now() where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Datos del partido para el árbitro, solo con un código válido y sin caducar.
-- Las fotos se sirven aparte con enlaces firmados de corta duración (función de Netlify).
create function public.fichas_arbitro(p_token text)
returns table (equipo text, rival text, fecha timestamptz, dorsal text, nombre text, titular boolean, foto_path text)
language sql stable security definer set search_path = public as $$
  select e.nombre, p.rival, p.fecha,
         coalesce(nullif(c.dorsal_partido, ''), f.dorsal),
         j.nombre, c.titular, f.foto_path
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
revoke execute on function public.aceptar_invitaciones() from public, anon;
grant execute on function public.aceptar_invitaciones() to authenticated;

-- ---------------------------------------------------------------- Fotos de las fichas (almacenamiento privado)
-- Ruta de cada foto: <equipo_id>/<archivo>.jpg

insert into storage.buckets (id, name, public)
values ('fichas', 'fichas', false)
on conflict (id) do nothing;

create policy fichas_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fichas' and public.puede_ver_equipo(public.uuid_o_null((storage.foldername(name))[1])));
create policy fichas_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'fichas' and public.puede_ver_equipo(public.uuid_o_null((storage.foldername(name))[1])));
create policy fichas_fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'fichas' and public.puede_ver_equipo(public.uuid_o_null((storage.foldername(name))[1])))
  with check (bucket_id = 'fichas' and public.puede_ver_equipo(public.uuid_o_null((storage.foldername(name))[1])));
create policy fichas_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'fichas' and public.puede_ver_equipo(public.uuid_o_null((storage.foldername(name))[1])));
