-- =====================================================================
-- 0006 · Próximo partido: citación, casa/fuera y qué llevar
-- Ejecutar en Supabase → SQL Editor después de 0005.
-- (fecha y lugar ya existían en partidos)
-- =====================================================================

alter table public.partidos add column if not exists cita text
  check (cita is null or cita ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.partidos add column if not exists es_local boolean;
alter table public.partidos add column if not exists notas text check (char_length(notas) <= 500);
