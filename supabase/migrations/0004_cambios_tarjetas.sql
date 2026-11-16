-- =====================================================================
-- 0004 · Cambios, tarjetas y minutos jugados
-- Ejecutar en Supabase → SQL Editor después de 0003.
--
-- eventos: además de goles, cambios (ficha_id = sale, ficha_entra = entra) y tarjetas.
--          «segundo» = segundo de juego dentro de la parte (precisión para los minutos).
-- convocatorias.segundos_jugados: tiempo en el campo de cada jugadora en ese partido
--          (lo calcula la app con el cronómetro y lo sube al sincronizar).
-- =====================================================================

alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('gol', 'gol_rival', 'cambio', 'amarilla', 'roja'));

-- Antes: solo los goles propios llevaban ficha. Ahora solo el gol rival va sin ficha.
alter table public.eventos drop constraint if exists eventos_check;
alter table public.eventos drop constraint if exists eventos_ficha_check;
alter table public.eventos add constraint eventos_ficha_check check (tipo <> 'gol_rival' or ficha_id is null);

alter table public.eventos add column if not exists ficha_entra uuid references public.fichas on delete set null;
alter table public.eventos add column if not exists segundo integer check (segundo >= 0);
alter table public.eventos drop constraint if exists eventos_entra_check;
alter table public.eventos add constraint eventos_entra_check check (tipo = 'cambio' or ficha_entra is null);

alter table public.convocatorias add column if not exists segundos_jugados integer not null default 0
  check (segundos_jugados >= 0);

-- La jugadora que entra también tiene que ser del equipo del partido
drop policy if exists eventos_equipo on public.eventos;
create policy eventos_equipo on public.eventos for all to authenticated
  using (public.puede_ver_partido(partido_id))
  with check (public.puede_ver_partido(partido_id)
              and public.ficha_del_partido(ficha_id, partido_id)
              and public.ficha_del_partido(ficha_entra, partido_id));
