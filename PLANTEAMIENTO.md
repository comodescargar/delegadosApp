# App Delegado — Planteamiento inicial

App para delegados/as y cuerpo técnico de fútbol base (**fútbol 7, fútbol 11 y fútbol sala**):
- Llevar las fichas de jugadores/as del equipo y sus dorsales.
- Preparar **alineaciones** sobre el campo.
- **Pizarra táctica** con **sistemas y jugadas precargadas** para cada modalidad.
- Anotar lo que pasa en el partido (goles, tarjetas, cambios).
- Enseñar las fichas al árbitro con **un solo enlace** válido solo para ese partido.

**Alcance decidido:**
- De momento la usará **un solo club**, el nuestro, que compite en la **Real Federación Andaluza de Fútbol (RFAF)**.
- No hace falta alta de clubes ni panel de "superadmin": el club se crea una vez al instalar.
- Aun así, el modelo de datos mantiene la entidad Club, para poder abrirlo a otros clubes más adelante sin rehacer nada.
- **Club piloto: Vandalia de Peligros** (Peligros, Granada → delegación de Granada de la RFAF, a confirmar).
- La pizarra incluye también **ejercicios de entrenamiento** (rondos, conducción, finalización, 1 contra 1, oleadas…).

### Estado a 13/11/2026: versión 0 en uso

La versión 0 (hoy en `index.html` y `public/js/`) funciona sin servidor y se publica como página de claude.ai con `npm run publicar:artifact`, que genera `dist-artifact/`:
- **Fichas**: foto de cada licencia desde la galería o la cámara, dorsal habitual, **dorsal del partido**, convocada y **titular**. Modo **«Enseñar al árbitro»** a pantalla completa (titulares y suplentes, una a una o todas).
- **Partido**: marcador, **cronómetro o cuenta atrás por partes**, goles por jugadora con minuto y resumen para WhatsApp.
- **Pizarra**: 20 sistemas, 57 jugadas animadas y 9 ejercicios para sala, F7 y F11; editor con pasos animados.

Limitaciones de la versión 0, que resolverá la app definitiva:
- Los datos (fotos incluidas) se guardan **solo en el móvil** que los creó. No se comparten entre delegados ni hay copia de seguridad.
- El árbitro ve las fichas **en el móvil del delegado**: todavía no hay enlace propio para él.
- Hay que confirmar con el árbitro o la delegación que acepta las fichas en el móvil. Mientras tanto, llevar el medio oficial de siempre como respaldo.

---

## 1. Usuarios y roles

| Rol | Qué puede hacer |
|---|---|
| **Admin de club** | Coordinador/a o directiva. Crea los equipos de cada temporada, invita a delegados/as y entrenadores/as, ve todo el club. Puede publicar jugadas "del club" para todos los equipos. |
| **Delegado/a** | Pertenece a uno o varios equipos del club. Gestiona fichas, convocatorias, alineaciones y partidos **solo de sus equipos**. |
| **Entrenador/a** | Igual que delegado/a en lo deportivo: alineaciones, pizarra, jugadas, anotar en el partido. |
| **Árbitro/a** | No tiene cuenta. Entra por un enlace temporal de solo lectura para un partido concreto. |

Un usuario puede estar en más de un equipo (p. ej. lleva el Alevín A y ayuda en el Benjamín B), así que la relación usuario ↔ equipo es N:M, con un rol en cada equipo.

---

## 2. Modalidades

La modalidad del equipo condiciona el campo que se dibuja, cuántos jugadores/as hay en la alineación y qué sistemas y jugadas se ofrecen.

| Modalidad | En el campo | Convocatoria habitual | Particularidades |
|---|---|---|---|
| **Fútbol sala** | 5 (portero/a + 4) | hasta 12-14 | Cambios ilimitados y "volantes", saque de banda con el pie, portero-jugador, 5 faltas acumuladas. |
| **Fútbol 7** | 7 (portero/a + 6) | hasta 14 | Prebenjamín/benjamín/alevín; cambios ilimitados en muchas federaciones. |
| **Fútbol 11** | 11 (portero/a + 10) | hasta 18 | Infantil en adelante; nº de cambios según competición. |
| ~~Fútbol 8~~ | 8 | — | Lo usan otras federaciones (p. ej. la valenciana). **Fuera del alcance** salvo que la RFAF o la delegación lo use en alguna competición nuestra. |

**Normativa RFAF.** La duración de los partidos, el número de cambios, la convocatoria máxima y las categorías de cada modalidad dependen de las circulares de la RFAF de cada temporada y de la delegación provincial. **No las metemos fijas en el código**: el admin las configura por categoría al empezar la temporada, a partir de la circular vigente. Hay que conseguir esas circulares de la temporada 2026/27 (fútbol 7, fútbol 11 y fútbol sala base) antes de programar el marcador y los cambios.

---

## 3. Modelo de datos (borrador)

```
Club ─┬─< Equipo (temporada, categoría, modalidad) ─┬─< Ficha de jugador/a (dorsal, posiciones)
      │                                              ├─< Staff del equipo
      │                                              └─< Partido ─┬─< Convocatoria
      │                                                           ├─< Alineación ─< Posición en campo
      │                                                           ├─< Evento (gol, tarjeta, cambio…)
      │                                                           └── Enlace árbitro (token, caduca)
      ├─< Miembro del club (usuario + rol)  >── Usuario
      └─< Pizarra / Jugada (del club o de un equipo)

Biblioteca global (precargada, igual para todos):
      Sistema táctico (modalidad, posiciones)    Jugada (modalidad, categoría, pasos animados)
```

### Entidades principales

- **Club**: nombre, escudo, federación territorial, colores.
- **Temporada**: p. ej. 2026/27. Las fichas y equipos se renuevan cada temporada.
- **Equipo**: club, temporada, nombre ("Alevín A"), categoría (prebenjamín… juvenil), **modalidad** (sala / F7 / F11), competición y grupo RFAF, género (masculino, femenino, mixto), sistema táctico preferido.
- **Jugador/a** (persona, perdura entre temporadas): nombre, apellidos, fecha de nacimiento, foto.
- **Reglas de categoría** (configurables por temporada según la circular RFAF): modalidad, duración y nº de partes, convocatoria máxima, tipo de cambios (ilimitados / con reingreso / número fijo), faltas acumuladas en sala.
- **Ficha** (jugador/a en un equipo y temporada): nº de licencia RFAF, dorsal habitual, **posiciones** (portero/a, cierre, ala, pívot… o defensa, medio, delantero/a…), pie dominante, estado (activa / baja / lesionada), caducidad de la licencia.
- **Staff**: nombre, cargo, nº de licencia.
- **Partido**: equipo, rival, fecha/hora, campo, local/visitante, competición/jornada, estado (programado → en juego → finalizado).
- **Convocatoria**: fichas convocadas, dorsal del día, capitán/a.
- **Alineación**: partido, sistema táctico usado, y para cada titular su posición en el campo. Puede haber varias por partido (1ª parte, 2ª parte, plan B).
- **Evento de partido**: tipo (gol, gol en propia, tarjeta, cambio, falta acumulada en sala), minuto/parte, jugador/a, asistencia.
- **Sistema táctico**: modalidad, nombre ("2-3-1", "4-3-3", "1-2-1 rombo"), lista de posiciones con coordenadas y rol. Precargado o creado por el equipo.
- **Pizarra / Jugada**: modalidad, título, categoría, descripción, y una lista de **pasos** (fotogramas). Cada paso tiene los elementos dibujados. Origen: precargada, del club o del equipo.
- **Enlace árbitro**: token aleatorio largo, partido, válido desde/hasta, revocable.

> Los datos sensibles (DNI, teléfonos de familias, datos médicos) **no** se guardan en la v1. Solo lo necesario para identificar a la ficha ante el árbitro.

---

## 4. Funcionalidades por fases

### MVP (v1) — lo imprescindible para un sábado de partido
1. **Login** sin contraseñas (enlace mágico por email).
2. **Club y equipos** con su modalidad; invitar a delegados/as y entrenadores/as.
3. **Fichas** con foto desde la cámara del móvil, licencia, dorsal y posiciones. Importación desde CSV/Excel.
4. **Partidos y convocatoria** con dorsales del día.
5. **Alineación** visual: eliges un sistema precargado y arrastras a los convocados/as a cada posición del campo. Banquillo con suplentes.
6. **Enlace para el árbitro** con QR: convocados/as con foto, nombre, dorsal y licencia, más el staff. Solo lectura, caduca solo.
7. **Marcador de goles** con los dorsales en botones grandes. Deshacer último evento.
8. **Resumen del partido** compartible por WhatsApp.

### Fase 2 — la parte táctica completa
- **Pizarra táctica** para las 3 modalidades (ver sección 6).
- **Biblioteca de jugadas precargadas** (ver sección 7) y jugadas propias del equipo o del club.
- Tarjetas y **cambios** desde la alineación (arrastrar del banquillo al campo), con control de **minutos jugados**. En sala, gestión de volantes y **faltas acumuladas**.
- Estadísticas de temporada por jugador/a (goles, partidos, minutos, titularidades).
- Avisos de licencias a punto de caducar.
- Funcionar **sin conexión** en el campo y sincronizar después.

### Fase 3 / ideas
- **Ejercicios de entrenamiento** con la misma pizarra (rondos, posesiones, finalización…) y planificación de sesiones.
- Exportar jugadas como imagen, PDF o vídeo corto (GIF/MP4) para mandar al grupo.
- Enlace para familias con el marcador en directo.
- Abrir la app a otros clubes (ya contemplado en el modelo).
- Exportar acta en PDF.
- Importar calendario y resultados de la RFAF, si su web o app lo permite.

---

## 5. El enlace del árbitro (pieza clave)

- URL tipo `https://appdelegado.es/a/Xk92-pQ7f-...`. El token es aleatorio, imposible de adivinar y no contiene datos del partido.
- Se activa unas horas antes del partido y **caduca solo** (p. ej. 6 h después del inicio). Se puede revocar en cualquier momento.
- Página con `noindex`, sin navegación a otros partidos ni equipos.
- Muestra solo foto, nombre, dorsal y nº de licencia. Nada de fechas de nacimiento completas ni datos de contacto.
- **No muestra la alineación ni nada táctico.**
- Se comparte por WhatsApp o enseñando un **QR**.
- Opcional: registro de cuándo se abrió el enlace.

**Encaje con la RFAF.** La RFAF tiene su propia app oficial ("RFAF APP"). Antes de construir esta parte hay que confirmar con un árbitro o la delegación provincial **cómo se comprueban hoy las licencias en partidos de base**: en papel, con la app de la federación o con acta digital.
- Si ya lo hacen en digital, nuestro enlace sería un **apoyo**: identificación rápida con foto y dorsal del día, sin sustituir nada oficial.
- Si se hace en papel, el enlace puede ahorrar llevar las fichas impresas, siempre que el comité de árbitros lo acepte.

---

## 6. Alineaciones y pizarra táctica

### Alineación
- El campo se dibuja según la modalidad del equipo (pista de sala, campo de F7 o F11).
- Eliges un **sistema** (precargado o propio) y aparecen las posiciones. Arrastras a cada convocado/a a su sitio; también se puede mover una posición libremente.
- Cada ficha en el campo muestra dorsal, nombre corto y foto pequeña. Los suplentes quedan en un banquillo debajo.
- Aviso si alguien juega fuera de sus posiciones habituales (solo informativo).
- Varias alineaciones por partido: 1ª parte, 2ª parte, plan B. En sala, **quintetos** guardados para rotar.
- Compartir la alineación como imagen al grupo del equipo.
- Durante el partido, la alineación es la base del marcador: los cambios se hacen arrastrando del banquillo al campo y así se calculan los minutos.

### Pizarra táctica
Lienzo libre sobre el campo de la modalidad, pensado para usarlo con el dedo en el móvil o la tablet:
- **Elementos**: jugadores/as propios (con dorsal o nombre), rivales, balón, porterías, conos, picas, vallas, miniporterías.
- **Líneas**: pase (recta), conducción (ondulada), desmarque o movimiento sin balón (discontinua), tiro.
- **Zonas** sombreadas y textos.
- **Pasos animados**: la jugada se construye por fotogramas. Al darle a reproducir, jugadores/as y balón se mueven de un paso al siguiente.
- Vista de campo completo, medio campo o zona de área.
- Guardar como jugada del equipo, publicarla para el club, duplicar una precargada y modificarla.
- Compartir con un enlace de solo lectura (como el del árbitro, pero para jugadoras/es y familias) o como imagen.

### Cómo se guarda (técnico)
Las posiciones se guardan en **coordenadas relativas** (0 a 1 sobre el ancho y largo del campo), no en píxeles. Así la misma jugada se ve bien en cualquier pantalla y se puede reutilizar entre campos de distinto tamaño. Cada jugada es un documento JSON con sus pasos, fácil de versionar y de cargar como biblioteca.

---

## 7. Biblioteca precargada

Contenido que la app trae de serie. Hay que **crearlo nosotros** (dibujar cada sistema y jugada como JSON), así que conviene empezar con un núcleo pequeño y bien hecho e ir ampliando.

### Sistemas tácticos

| Modalidad | Sistemas |
|---|---|
| **Fútbol sala** | 1-2-1 (rombo), 2-2 (cuadrado), 3-1, 4-0, 1-1-2, portero-jugador (5 de campo) |
| **Fútbol 7** | 3-2-1, 2-3-1, 3-1-2, 2-1-2-1, 3-3 |
| **Fútbol 11** | 4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 3-5-2, 3-4-3, 5-3-2 |

### Jugadas, por categoría

| Categoría | Ejemplos | Modalidades |
|---|---|---|
| **Saque de esquina** | Primer palo, segundo palo, en corto, al borde del área | Todas |
| **Faltas** | Frontal (barrera, tiro directo, pase atrás), lateral (centro, jugada ensayada) | Todas |
| **Saque de banda** | Con la mano: hacia atrás, a la espalda, largo al área. Con el pie (sala): paralela, diagonal, pared | Mano: F7/F11. Pie: sala |
| **Salida de balón** | Desde portero/a en corto, con centrales abiertos, salida en largo, ante presión alta | Todas |
| **Ataque organizado** | Pared, desdoblamiento por banda, triangulación, cambio de orientación, tercer hombre | F7/F11 |
| **Ataque en sala** | Rotaciones en 4-0 ("el ocho"), paralela, diagonal, bloqueo y continuación, juego de pívot | Sala |
| **Transiciones** | Contraataque 3 contra 2, tras recuperación, repliegue tras pérdida | Todas |
| **Defensa** | Presión alta, bloque medio, repliegue, zona vs. individual, defensa de córner. En sala: 1-1-2, 2-2, presión en toda la pista | Todas |
| **Superioridad / inferioridad** | Ataque con portero-jugador, defensa de 4 contra 5 | Sala |

Cada jugada lleva: modalidad, categoría, nivel recomendado (por edades), descripción breve y sus pasos animados.

---

## 8. Protección de datos de menores (importante)

Al tratar fotos y datos de menores en España aplican el RGPD y la LOPDGDD:
- El **club** es el responsable del tratamiento y la app es la encargada. Hace falta un contrato de encargo y el consentimiento de las familias (normalmente ya se recoge en la inscripción, pero conviene que incluya este uso).
- Minimizar datos: solo lo necesario para la ficha.
- Fotos en almacenamiento privado, servidas con URLs firmadas de corta duración.
- Las jugadas y alineaciones compartidas **por enlace o como imagen** se pueden configurar para mostrar solo dorsales, sin nombres ni fotos.
- Al acabar la temporada o dar de baja: borrar o anonimizar.
- Servidores en la UE.

---

## 9. Propuesta técnica

Prioridades: uso **desde el móvil y la tablet**, rápida de construir, barata de mantener, datos seguros.

| Pieza | Propuesta | Por qué |
|---|---|---|
| App | **PWA** con **Next.js + React + TypeScript** | Una sola app para Android/iPhone/tablet sin tiendas; árbitro y familias abren un enlace sin instalar nada. |
| UI | Tailwind CSS + shadcn/ui | Rápido, limpio, botones grandes para el campo. |
| Pizarra y alineación | **SVG con React** + librería de gestos para arrastrar (p. ej. `@use-gesture`) + animaciones con Framer Motion | Nítido a cualquier tamaño, fácil exportar a imagen, funciona bien con el dedo. Si hiciera falta más rendimiento, se puede pasar a Canvas (Konva) sin cambiar el formato de datos. |
| Backend / BD | **Supabase** (Postgres + Auth + Storage), región UE | Login por email, permisos por fila, fotos privadas, plan gratuito para empezar. |
| Permisos | Row Level Security en Postgres | "Solo veo mis equipos" se aplica en la base de datos. |
| Biblioteca precargada | Archivos JSON versionados en el repositorio, cargados en la BD al desplegar | Se revisan y amplían como código. |
| Hosting | Vercel (o similar) | Despliegue automático, gratis al empezar. |

### 9.1 Decisión (16/11/2026): versión 1 sobre la versión 0, con Netlify + Supabase

La versión 0 funciona bien, así que **no se reescribe en Next.js**. Se evoluciona el mismo código (HTML + JavaScript) y se le añade la base de datos:

| Pieza | Elección |
|---|---|
| Código | Repositorio en **GitHub** con la app actual, empaquetada con **Vite** (ligero, sin cambiar la forma de programar). |
| Hosting | **Netlify**, conectado a GitHub: cada cambio subido se publica solo, con HTTPS y dirección propia (`algo.netlify.app`, o un dominio del club). |
| Usuarios | **Supabase Auth**: entrar con un enlace que llega al email, sin contraseñas. El coordinador invita a cada delegado y entrenador. |
| Base de datos | **Supabase Postgres** (región UE), con permisos por fila: cada usuario solo ve los equipos en los que está dado de alta. |
| Fotos de fichas | **Supabase Storage**, en un contenedor privado. Las fotos se sirven con enlaces temporales, nunca públicos. |
| Enlace del árbitro | Tabla de enlaces con un código aleatorio y fecha de caducidad. Una función del servidor devuelve solo las convocadas de ese partido, y solo mientras el enlace es válido. |
| Sin cobertura | Se mantiene la copia local en el móvil y se sincroniza cuando vuelve la conexión. |

**Tablas principales:** `clubes`, `temporadas`, `equipos`, `miembros` (usuario + equipo + rol), `jugadoras`, `fichas` (jugadora en equipo y temporada, dorsal, foto), `partidos`, `convocatorias` (dorsal del día, titular), `eventos` (goles, minuto, parte), `jugadas` (las propias del equipo o del club) y `enlaces_arbitro`.

**Lo que tiene que hacer el club (no se puede hacer por él):**
1. Crear cuentas gratuitas en GitHub, Netlify y Supabase (con un email del club, no personal).
2. Crear el proyecto de Supabase en región UE y pasar la *URL del proyecto* y la *clave pública (anon)*. **Nunca** la clave `service_role`.
3. Aspecto legal: el club es el responsable de los datos. Debe aceptar el acuerdo de tratamiento de datos (DPA) de Supabase y comprobar que el consentimiento de las familias cubre guardar la foto de la ficha en la app.

**Costes:** los planes gratuitos de Netlify y Supabase bastan para un club. Ojo: en el plan gratuito de Supabase, un proyecto que pasa una semana sin uso se pausa. En temporada no pasa; en verano habría que reactivarlo desde el panel.

**Orden de trabajo** (✔ = hecho el 16/11/2026, pendiente de probar contra el proyecto real de Supabase):
1. ✔ Repositorio (github.com/comodescargar/delegadosApp), Vite y configuración de Netlify.
2. ✔ Esquema de base de datos con sus permisos (`supabase/migrations/0001_esquema.sql`, 36 comprobaciones en `npm run test:bd`).
3. ✔ Login, equipos e invitaciones (sección «Club»).
4. Fichas en la nube, con un botón para subir las fichas ya guardadas en el móvil.
5. Partidos y goles en la nube.
6. Enlace del árbitro.
7. Jugadas propias compartidas por el club.

---

## 10. Pantallas (esbozo)

```
[Login]
   ↓
[Mis equipos]  ── Alevín A (F7) · Benjamín B (F7) · Infantil (F11) · Sala Cadete
   ↓
[Equipo]  pestañas: Plantilla | Partidos | Pizarra | Staff
   │
   ├─ Plantilla → [Ficha jugador/a] (foto, dorsal, licencia, posiciones)
   │
   ├─ Partidos → [Partido]
   │               ├─ Convocatoria (checklist + dorsales)
   │               ├─ Alineación ──────────────┐
   │               ├─ Compartir con árbitro     │   ┌───────────────────┐
   │               └─ En juego → [Marcador]     └─▶ │      ( 9 )        │
   │                                                │  ( 7 )     ( 11 ) │
   │                                                │  ( 4 ) ( 6 ) ( 8 )│
   │                                                │      ( 1 )        │
   │                                                │ Sistema: 3-2-1 ▾  │
   │                                                │ Banquillo: 3 5 14 │
   │                                                └───────────────────┘
   │
   └─ Pizarra → [Biblioteca]  filtros: modalidad · categoría · precargadas / del club / mías
                   ↓
                [Editor de pizarra]
                ┌──────────────────────────────┐
                │ campo  ● ○ ⚽ ▲  → ⤳ ⇢  ▭  T │  ← herramientas
                │                              │
                │      (lienzo del campo)      │
                │                              │
                │ ◀ Paso 2/5 ▶   ▶ Reproducir │
                └──────────────────────────────┘

[Vista árbitro]  (sin login, desde el enlace)
   Escudo · Alevín A vs CD Rival · Sáb 15/11 10:00
   ┌────┬──────────────┬────┬──────────┐
   │foto│ Nombre       │ Nº │ Licencia │
   └────┴──────────────┴────┴──────────┘
   Staff: Delegado/a, Entrenador/a
```

---

## 11. Preguntas abiertas

**Ya respondidas:** solo nuestro club (de momento) · Federación Andaluza (RFAF).

1. ¿De qué **delegación provincial** de la RFAF sois? Las normas de base pueden variar por delegación.
2. ¿Cómo comprueba hoy el árbitro las licencias en vuestros partidos de base: papel, RFAF APP o acta digital? ¿Qué datos mira?
3. ¿Qué **categorías y modalidades** tiene el club esta temporada (p. ej. 2 benjamines F7, 1 alevín F7, 1 infantil F11, 1 cadete sala…)? ¿Cuántos equipos y delegados/as hay en total?
4. ¿Tenéis a mano las **circulares RFAF 2026/27** de fútbol 7, fútbol 11 y sala (cambios, duración, convocatoria)?
5. ¿Anotar solo goles en la v1, o también tarjetas y cambios?
6. ¿Hace falta que funcione sin cobertura desde la v1?
7. ¿La pizarra se usará más en el **móvil** (en el banquillo) o en **tablet/ordenador** (preparando entrenamientos)? Cambia el diseño del editor.
8. ¿Quieres que la pizarra sirva también para **ejercicios de entrenamiento** o solo para jugadas de partido?
9. ¿Hay alguien en el club (entrenador/a con titulación) que pueda revisar las jugadas precargadas?
10. Stack: ¿vamos con Next.js + Supabase?

---

## 12. Siguientes pasos

1. Cerrar las preguntas abiertas.
2. Crear el proyecto (Next.js + Supabase) y el esquema de base de datos con sus permisos.
3. Construir el **componente de campo** (SVG) para las 3 modalidades (sala, F7, F11). Lo usan la alineación, la pizarra y el marcador, así que conviene hacerlo bien desde el principio.
4. MVP en este orden: login → equipos/fichas → partido + convocatoria → alineación → enlace árbitro → marcador.
5. Probarlo con un equipo real un fin de semana.
6. Fase 2: editor de pizarra → biblioteca de sistemas → jugadas precargadas (empezando por balón parado, que es lo más usado en base).
