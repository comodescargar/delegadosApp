# Delegados App

App para delegados y cuerpo técnico de fútbol base (fútbol sala, F7 y F11):

- **Fichas**: foto de cada licencia, dorsal habitual y del partido, convocadas y titulares, y modo «Enseñar al árbitro».
- **Partido**: marcador, cronómetro o cuenta atrás por partes, goles por jugadora y resumen para WhatsApp.
- **Pizarra**: sistemas, jugadas y ejercicios de entrenamiento animados (111 en la biblioteca), y editor propio.
- **Club** (con Supabase): acceso por email sin contraseña, equipos, invitaciones y permisos por equipo.
- **Nube** (con Supabase): fichas, fotos, convocatoria y goles compartidos por equipo, con cola de cambios para cuando no hay cobertura, y **enlace para el árbitro** (`/a/<código>`, con QR) que caduca en 8 horas.

Sin configurar Supabase, la app funciona en **modo local**: todo se guarda solo en el móvil.

## Estructura

| Carpeta | Contenido |
|---|---|
| `index.html`, `public/js/` | La app: pizarra, biblioteca, fichas y partido (JavaScript sin dependencias). |
| `src/` | Conexión con Supabase: sección «Club» (`main.js`), sincronización (`sync.js`) y página del árbitro (`arbitro.js`). |
| `pruebas/` | Supabase falsa en memoria para probar la sincronización en el navegador. |
| `supabase/migrations/` | Esquema de la base de datos con permisos por fila. |
| `supabase/semilla.sql` | Alta del club, la temporada y el primer administrador. |
| `supabase/pruebas/` | Pruebas del esquema y de los permisos en un Postgres local (`npm run test:bd`). |
| `scripts/` | Publicación como página de claude.ai (`npm run publicar:artifact`). |
| `PLANTEAMIENTO.md` | Planteamiento funcional y decisiones. |

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run test:bd    # comprueba el esquema y los permisos (no necesita Supabase)
npm run build      # genera dist/
```

## Despliegue (Netlify + Supabase)

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) en una región de la UE (p. ej. *Frankfurt*).
2. **SQL Editor → New query**: pega y ejecuta, en orden, cada archivo de `supabase/migrations/` (`0001_esquema.sql`, `0002_arbitro_fotos.sql`…). Si Supabase avisa de «operaciones destructivas», es porque se reemplazan funciones o reglas de permisos: no se borran datos.
3. Abre `supabase/semilla.sql`, cambia `cambia-esto@ejemplo.com` por tu email (en minúsculas) **solo en el editor de Supabase, no en el repositorio**, y ejecútalo. Así quedas como administrador del club.
4. **Authentication → URL Configuration**:
   - *Site URL*: la dirección de Netlify (p. ej. `https://delegados.netlify.app`).
   - *Redirect URLs*: añade esa misma dirección y `http://localhost:5173`.
5. Opcional, recomendado: **Authentication → Email Templates → Magic Link**: añade `Tu código: {{ .Token }}` al texto. Así, si el enlace del correo se abre en otro navegador, se puede escribir el código en la app.
6. **Project Settings → API Keys**: copia la *Project URL* (`https://<proyecto>.supabase.co`) y la **publishable key** (`sb_publishable_…`).

> La **secret key** (`sb_secret_…`), la `service_role` y la contraseña de la base de datos **no se ponen nunca** en la app ni en el repositorio.

### 2. Netlify

1. **Add new site → Import an existing project → GitHub** y elige este repositorio.
2. La configuración de compilación ya está en `netlify.toml` (`npm run build`, carpeta `dist`).
3. **Site configuration → Environment variables**:
   - `VITE_SUPABASE_URL` = Project URL de Supabase
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key (`sb_publishable_…`)
4. Lanza el despliegue (*Deploys → Trigger deploy*). Cada cambio que se suba a `main` se publicará solo.

### 3. Primer uso

1. Abre la app, ve a **Club** y entra con el email de la semilla.
2. Crea los equipos de la temporada.
3. Invita a cada delegado o entrenador con su email y su equipo. Cuando entren con ese email, verán su equipo.

## Protección de datos

El club es el responsable del tratamiento de los datos de las jugadoras (menores). Antes de usar la versión con Supabase:

- Acepta el acuerdo de tratamiento de datos (DPA) de Supabase.
- Comprueba que el consentimiento de las familias cubre guardar la foto de la ficha en la app.
- Las fotos se guardan en un almacenamiento privado y solo las ven los miembros del equipo.
