-- =====================================================================
-- Datos iniciales del club. Ejecutar UNA vez en Supabase → SQL Editor,
-- después de 0001_esquema.sql.
--
-- ANTES DE EJECUTAR: cambia el email de la última línea por el tuyo
-- (en minúsculas). Con ese email entrarás como administrador del club.
-- =====================================================================

with club as (
  insert into public.clubes (nombre, federacion)
  values ('Vandalia de Peligros', 'Real Federación Andaluza de Fútbol')
  returning id
), temporada as (
  insert into public.temporadas (club_id, nombre, activa)
  select id, '2026/27', true from club
  returning club_id
)
insert into public.invitaciones (club_id, equipo_id, email, rol)
select club_id, null, 'cambia-esto@ejemplo.com', 'admin' from temporada;
