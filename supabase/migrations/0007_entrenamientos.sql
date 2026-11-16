-- =====================================================================
-- 0007 · Asistencia a entrenamientos
-- Ejecutar en Supabase → SQL Editor después de 0006.
-- =====================================================================

create table if not exists public.entrenamientos (
  id          uuid primary key default gen_random_uuid(),
  equipo_id   uuid not null references public.equipos on delete cascade,
  fecha       date not null,
  nota        text check (char_length(nota) <= 300),
  creado_en   timestamptz not null default now()
);
create index if not exists entrenamientos_equipo_fecha on public.entrenamientos (equipo_id, fecha);

create table if not exists public.asistencias (
  entrenamiento_id  uuid not null references public.entrenamientos on delete cascade,
  ficha_id          uuid not null references public.fichas on delete cascade,
  estado            text not null check (estado in ('si', 'no', 'justificada')),
  primary key (entrenamiento_id, ficha_id)
);

alter table public.entrenamientos enable row level security;
alter table public.asistencias    enable row level security;

create or replace function public.puede_ver_entrenamiento(p_entreno uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from entrenamientos where id = p_entreno and public.puede_ver_equipo(equipo_id));
$$;

-- La ficha es del mismo equipo que el entrenamiento
create or replace function public.ficha_del_entrenamiento(p_ficha uuid, p_entreno uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from fichas f join entrenamientos e on e.equipo_id = f.equipo_id
                 where f.id = p_ficha and e.id = p_entreno);
$$;

drop policy if exists entrenamientos_equipo on public.entrenamientos;
create policy entrenamientos_equipo on public.entrenamientos for all to authenticated
  using (public.puede_ver_equipo(equipo_id)) with check (public.puede_ver_equipo(equipo_id));

drop policy if exists asistencias_equipo on public.asistencias;
create policy asistencias_equipo on public.asistencias for all to authenticated
  using (public.puede_ver_entrenamiento(entrenamiento_id))
  with check (public.puede_ver_entrenamiento(entrenamiento_id) and public.ficha_del_entrenamiento(ficha_id, entrenamiento_id));

revoke all on public.entrenamientos, public.asistencias from anon;
grant select, insert, update, delete on public.entrenamientos, public.asistencias to authenticated;
