# Galería NightDaro

Galería pública y panel de administración de NightDaro en una sola app Next.js 15. La arquitectura está en [docs/arquitectura.md](docs/arquitectura.md).

## Requisitos

- Node.js 22
- pnpm 11
- Docker (para el Postgres local)

## Levantar el proyecto en local

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Crear el archivo de variables y completar los valores:

   ```bash
   cp .env.example .env.local
   ```

   `AUTH_SECRET` se genera con `openssl rand -base64 32`. En local y en Render va `AUTH_TRUST_HOST=true`, porque Auth.js corre detrás de un proxy fuera de Vercel.

   Para el Postgres de Docker: `DATABASE_URL=postgres://nightdaro:nightdaro@localhost:5433/nightdaro`. El puerto local es 5433 para no chocar con otro Postgres en 5432; se cambia con `POSTGRES_PORT` (por ejemplo `POSTGRES_PORT=5434 docker compose up -d`).

3. Levantar Postgres 16:

   ```bash
   docker compose up -d
   ```

4. Crear las tablas y cargar los datos iniciales (completar antes `SEED_DARO_*` y `SEED_DAMI_*` en `.env.local`):

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

   El seed crea la configuración del sitio de NightDaro, tres tiers de Patreon de ejemplo y los dos usuarios admin con contraseñas hasheadas con argon2id. Se puede correr varias veces: no duplica ni pisa filas existentes.

5. Iniciar el servidor de desarrollo y abrir http://localhost:3000. El panel está en `/admin` y se entra en `/login` con un usuario del seed:

   ```bash
   pnpm dev
   ```

## Scripts

| Script           | Qué hace                                                        |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo                                          |
| `pnpm build`     | Build de producción                                             |
| `pnpm start`     | Sirve el build de producción                                    |
| `pnpm lint`      | ESLint, incluida la regla de capas de `src/core`                |
| `pnpm typecheck` | TypeScript sin emitir archivos                                  |
| `pnpm test`      | Vitest                                                          |
| `pnpm format`    | Prettier sobre todo el repo (`pnpm format:check` solo verifica) |

## Estructura

| Carpeta          | Contenido                                            |
| ---------------- | ---------------------------------------------------- |
| `src/app`        | Rutas de Next.js (galería, `/admin`, route handlers) |
| `src/core`       | Entidades, casos de uso y puertos en TypeScript puro |
| `src/infra`      | Adaptadores (Drizzle, Bunny, sharp) y `container.ts` |
| `src/db`         | Schema, migraciones y seed de Drizzle                |
| `src/components` | Componentes de UI (`ui/` es shadcn/ui)               |

`src/core` no puede importar `next`, `react` ni `drizzle-orm`: ESLint falla si lo hace. Los colores de marca son tokens en `src/app/globals.css` (`brand-violet`, `brand-sky`, `brand-green`, `brand-indigo`), mapeados a los tokens de shadcn/ui (`primary`, `secondary`, `accent`, `background`).

## Tests de integración

Los archivos `*.integration.test.ts` corren contra Postgres. Cada suite crea y migra su propia base `<db>_test_<nombre>` en el mismo servidor, así nunca tocan los datos de desarrollo. Con Docker levantado y `DATABASE_URL` en `.env.local`, `pnpm test` los corre; en CI usan el servicio Postgres 16 del workflow.

## Acceso al panel

- Auth.js v5 con credenciales contra la tabla `users` (argon2id). Sesión JWT en cookie `httpOnly` de 30 días; con HTTPS la cookie es `Secure`.
- `src/middleware.ts` redirige a `/login` cualquier ruta `/admin` sin sesión, y el layout de `/admin` vuelve a verificarla.
- Cada Server Action del panel llama primero a `requireAdmin()` (`src/auth.ts`), que lanza `UnauthorizedError` sin sesión.
- El login admite 5 intentos por minuto por IP, en memoria (alcanza con una sola instancia).

## Panel

- **Subir** (`/admin/subir`) crea una obra como borrador. La imagen se suma en el paso de subida de imágenes.
- **Galería** (`/admin/galeria?tipo=finished|wip|timelapse`) ordena cada pestaña arrastrando (mouse o teclado: Espacio, flechas, Espacio), y permite editar, publicar, ocultar y borrar.
- **Página** (`/admin/pagina`) edita nombre, bio, SEO, color de acento, puerta +18 y redes (links `https://`).
- **Links** (`/admin/links`) administra los tiers y los links de seguimiento `/r/{código}`.

Cada Server Action del panel llama primero a `requireAdmin()`, valida con el esquema Zod del caso de uso (`src/core/**`), ejecuta el caso de uso desde `src/infra/container.ts` y revalida todo el sitio.

## Imágenes

`/admin/subir` sube la imagen (JPG, PNG o WebP, hasta 30 MB) a `POST /api/admin/artworks`, que crea el borrador y corre `UploadArtworkImage`:

1. Valida el tipo real por magic bytes (`file-type`): un SVG o un `.exe` renombrado a `.jpg` se rechazan.
2. Guarda el original sin metadatos (EXIF, GPS) en la zona `originals`, que no tiene URL pública.
3. Genera con sharp la miniatura de 400 px, la preview de 1600 px WebP q75 con marca de agua en mosaico y un placeholder de 20 px, y los guarda en la zona `public`.
4. Si la obra es `explicit`, las variantes públicas salen de la versión censurada que suba Daro o, si no hay, de un desenfoque fuerte.

Las claves empiezan con `nightdaro/`. Cada imagen guarda el rating para el que se generaron sus variantes (`rendered_rating`). Si la obra tiene ahora un rating más estricto, por ejemplo por dos ediciones cruzadas, esa imagen no se firma, y la Galería del panel la vuelve a generar desde el original. Las páginas reciben solo URLs firmadas de la zona pública, que vencen en 1 hora (Bunny Token Authentication, HMAC-SHA256); nunca una clave del original.

| Variable                                    | Uso                                                                                                                                                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_DRIVER`                            | Obligatoria en producción. `local` (por defecto en desarrollo) guarda en `LOCAL_STORAGE_DIR` (`.storage`) y sirve la zona pública en `/dev-media`, verificando el mismo token; `bunny` usa Bunny Storage y la Pull Zone |
| `BUNNY_ZONE_ORIGINALS`, `BUNNY_ZONE_PUBLIC` | Nombres de las dos storage zones                                                                                                                                                                                        |
| `BUNNY_STORAGE_KEY`                         | Contraseña de las zonas; si son distintas, `BUNNY_STORAGE_KEY_ORIGINALS` y `BUNNY_STORAGE_KEY_PUBLIC`                                                                                                                   |
| `BUNNY_STORAGE_HOST`                        | Endpoint de la región (por defecto `storage.bunnycdn.com`)                                                                                                                                                              |
| `BUNNY_CDN_HOST`, `BUNNY_TOKEN_KEY`         | Host de la Pull Zone de `public` y su clave de Token Authentication                                                                                                                                                     |

La marca de agua es `src/infra/media/assets/watermark-tile.png`, generada con `node scripts/build-watermark.mjs` para que el servidor no dependa de fuentes instaladas.

## Timelapses

En `/admin/subir`, con el tipo **Timelapse**, el panel llama a `startTimelapseUploadAction`. Esa acción crea el borrador y el video vacío en Bunny Stream, y devuelve una firma TUS que sirve solo para ese video y dura 6 horas (`sha256(library_id + api_key + expiración + video_id)`). El navegador sube el archivo directo a Bunny con `tus-js-client`, así que el video nunca pasa por el servidor.

Un timelapse no puede ser **explícito**: los videos no se censuran, y lo explícito queda solo en Patreon.

El video queda en **Procesando** hasta que Bunny termina el encoding. Si el archivo nunca llega (por ejemplo, se cerró la pestaña a mitad de la subida), pasa a **Video con error** cuando vencen las 6 horas de la autorización. `/admin/galeria?tipo=timelapse` consulta el estado real a la API al cargar y se refresca cada 10 s mientras haya algo procesando. Si se configura el webhook, Bunny avisa al terminar. Cuando el video está listo, la galería recibe la URL del player (HLS) firmada por 1 hora.

| Variable                                          | Uso                                                                                                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY` | Librería de Stream y su API key. Sin ellas, subir un timelapse explica qué falta                                                                                              |
| `BUNNY_STREAM_TOKEN_KEY`                          | Clave de "Embed view token authentication" de la librería, para firmar el player                                                                                              |
| `BUNNY_STREAM_READONLY_KEY`                       | Opcional: activa el webhook `POST /api/webhooks/bunny-stream`. Verifica la firma v1 (HMAC-SHA256 del body) y vuelve a consultar el estado a la API, sin confiar en el payload |

En la librería de Stream conviene activar la autenticación por token del embed, la marca de agua y los dominios permitidos. Con un token inválido, Bunny responde igual HTTP 200, pero con una página que dice "403" y sin player.

Prueba en vivo contra la librería configurada (sube un video de 3 s, espera el encoding, prueba la URL firmada y lo borra): `STREAM_LIVE=1 pnpm test:e2e timelapse-live`.
