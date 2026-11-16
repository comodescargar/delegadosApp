-- =====================================================================
-- 0005 · Fin de temporada (borrado de datos personales)
-- Ejecutar en Supabase → SQL Editor después de 0004.
--
-- Al borrar las fichas de un equipo, los nombres de las jugadoras (tabla jugadoras, del club)
-- pueden quedarse sin ninguna ficha. Esta función los borra. Solo la administración del club.
-- =====================================================================

create or replace function public.limpiar_jugadoras_sin_ficha(p_club uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.es_admin_club(p_club) then
    raise exception 'Solo la administración del club puede hacerlo';
  end if;
  delete from public.jugadoras j
   where j.club_id = p_club
     and not exists (select 1 from public.fichas f where f.jugadora_id = j.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.limpiar_jugadoras_sin_ficha(uuid) from public, anon;
grant execute on function public.limpiar_jugadoras_sin_ficha(uuid) to authenticated;
