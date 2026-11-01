# Deploy

La galería corre como **un solo servicio en Render** (`render.yaml`), con Postgres en **Neon**, archivos y videos en **Bunny** y DNS y correo en **Cloudflare**. Dominio: **https://www.nightdaro.com**.

Orden recomendado: Neon → Bunny → Sentry → Render → Cloudflare → verificación. Cada paso deja anotados los valores que después se cargan en Render.

| Variable | De dónde sale |
| --- | --- |
| `DATABASE_URL` | Neon, cadena directa (paso 1) |
| `BUNNY_STORAGE_HOST`, `BUNNY_ZONE_ORIGINALS`, `BUNNY_ZONE_PUBLIC`, `BUNNY_STORAGE_KEY_ORIGINALS`, `BUNNY_STORAGE_KEY_PUBLIC` | Bunny Storage (paso 2) |
| `BUNNY_CDN_HOST`, `BUNNY_TOKEN_KEY` | Pull Zone de `public-media` (paso 2) |
| `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_STREAM_READONLY_KEY` | Bunny Stream (paso 3) |
| `SENTRY_DSN` | Sentry (paso 4) |
| `AUTH_SECRET`, `ANALYTICS_SALT` | Render los genera solos (`generateValue`) |
| `SITE_URL`, `AUTH_TRUST_HOST`, `STORAGE_DRIVER`, `CLIENT_IP_HEADER`, `CONTACT_EMAIL` | Ya vienen en `render.yaml` |

## 1. Neon (Postgres)

1. Crear un proyecto en Neon (plan Free) con **Postgres 16**, en la región **AWS US East 1 (N. Virginia)**, la misma zona que el servicio de Render (`region: virginia`).
2. En **Connect**, desactivar **Connection pooling** y copiar la cadena **directa**: el host **no** lleva `-pooler`. Las migraciones necesitan la conexión directa, y con un único servidor de 5 conexiones no hace falta el pooler.
   Neon agrega `&channel_binding=require` al final: **hay que sacarlo**. El driver de la app (postgres.js) lo manda a Postgres como si fuera una opción y la conexión falla con `unrecognized configuration parameter "channel_binding"`. La cadena queda así: `postgresql://neondb_owner:<contraseña>@ep-…us-east-1.aws.neon.tech/neondb?sslmode=require`.
3. Ese valor es `DATABASE_URL`.

En el plan Free, la base se suspende tras unos minutos sin uso, así que la primera visita después de un rato tarda un poco más. Por eso el health check de Render no la consulta. Los backups están en la sección 8.

## 2. Bunny Storage y CDN

### Zonas de almacenamiento

1. **Storage → Add Storage Zone** → nombre `nightdaro-originals`, en la región principal más cercana al servicio (Nueva York). Sin replicación. **No se le crea Pull Zone**: los originales no tienen URL pública.
2. Otra zona: `nightdaro-public`, en la misma región.
3. En cada zona, **FTP & API Access** muestra su **Password**: la de `originals` es `BUNNY_STORAGE_KEY_ORIGINALS` y la de `public` es `BUNNY_STORAGE_KEY_PUBLIC`. Si fueran la misma, alcanza con `BUNNY_STORAGE_KEY`.
4. `BUNNY_ZONE_ORIGINALS=nightdaro-originals` y `BUNNY_ZONE_PUBLIC=nightdaro-public`.
5. `BUNNY_STORAGE_HOST` es el endpoint de la región de las zonas: `ny.storage.bunnycdn.com` para Nueva York o `storage.bunnycdn.com` para Falkenstein. Bunny lo muestra en **FTP & API Access**.

### Pull Zone de `public-media`

1. En `nightdaro-public`, **Connected Pull Zones → Add Pull Zone**, con origen la storage zone.
2. **Security → Token Authentication**: activarlo. La clave que muestra es `BUNNY_TOKEN_KEY`. La app firma con el método avanzado (`HS256-…`), verificado contra los ejemplos oficiales de Bunny.
3. **Security → Allowed referrers**: `nightdaro.com` y `www.nightdaro.com`.
4. El hostname de la Pull Zone (por ejemplo `nightdaro-public.b-cdn.net`) es `BUNNY_CDN_HOST`, sin `https://`.

## 3. Bunny Stream

1. **Stream → Add Video Library** → `nightdaro`, que es la de producción, aparte de la de prueba.
2. **Security**:
   - activar **Embed view token authentication**; su clave es `BUNNY_STREAM_TOKEN_KEY`;
   - en **Allowed domains**, `www.nightdaro.com` y `nightdaro.com`.
3. **Player → Watermark**: subir el logo de NightDaro.
4. **API**: el **Library ID** es `BUNNY_STREAM_LIBRARY_ID`, la **API Key** es `BUNNY_STREAM_API_KEY` y la **Read-only API Key** es `BUNNY_STREAM_READONLY_KEY`. El **CDN Hostname** (`vz-….b-cdn.net`) es `BUNNY_STREAM_CDN_HOST`: con él, un timelapse sin portada toma como portada la miniatura que genera Bunny, procesada como cualquier obra (baja resolución y marca de agua). Si la librería tiene **CDN token authentication**, la miniatura se firma con la misma clave que el embed (`BUNNY_STREAM_TOKEN_KEY`), así que no hace falta otra variable.
5. **Webhooks** (opcional; el panel también consulta el estado solo): URL `https://www.nightdaro.com/api/webhooks/bunny-stream`.

Con un token inválido, el embed de Bunny responde igual HTTP 200, pero con una página que dice "403" y sin player. Para probar la librería: `STREAM_LIVE=1 pnpm test:e2e timelapse-live`, apuntando con `.env.local` a la librería que se quiere probar.

## 4. Sentry

1. Crear un proyecto **Next.js** en Sentry (plan Developer). Su **DSN** es `SENTRY_DSN`; la app lo usa en el servidor y en el navegador.
2. **Settings → Security & Privacy**: activar **Prevent Storing of IP Addresses** y **Data Scrubber**. La app ya no manda IPs, cookies ni usuarios (`src/sentry-options.ts`); esto es una segunda barrera.
3. Session Replay queda **desactivado** a propósito: grabaría lo que ve cada visitante, incluido el arte +18.
4. Opcional, para ver los stack traces con el código original: `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` como variables de Render; con ellas, el build sube los source maps.

## 5. Render

1. **New → Blueprint**, elegir el repo `galeria-nightdaro`. Render lee `render.yaml` y pide los valores marcados `sync: false`: los de los pasos 1 a 4.
2. Lo que hace cada deploy:
   - **Build:** `corepack enable && pnpm install --frozen-lockfile && pnpm build`. Corepack instala el pnpm de `package.json#packageManager`, y Node es la versión de `.node-version` (22).
   - **Pre-deploy:** `node_modules/.bin/drizzle-kit migrate`, que es lo mismo que `pnpm db:migrate`: aplica las migraciones contra Neon antes de cambiar de versión.
   - **Start:** `node_modules/.bin/next start`, que es lo mismo que `pnpm start`. Usar los binarios ya instalados evita que el arranque dependa de bajar pnpm.
   - **Health check:** Render da por sano el servicio cuando `GET /api/health` responde 200. No consulta la base a propósito: así Neon puede suspenderse cuando no hay visitas, y un corte de la base no reinicia la app. Para comprobar la base a mano, `GET /api/health?db=1`.
3. **Auto-deploy:** `autoDeployTrigger: checksPass` despliega `main` solo cuando el CI de GitHub está en verde.
4. **Seed inicial** (una sola vez): desde el **Shell** del servicio,

   ```bash
   corepack enable
   SEED_ADMIN_USERNAME='...' SEED_ADMIN_PASSWORD='...' pnpm db:seed
   ```

   Usar comillas simples en las contraseñas (`'...'`) para que la shell no interprete `$` ni `!`. El seed crea un solo admin, con rol **dueño**: los demás admins los crea el dueño desde el panel.

   Crea la configuración del sitio, los tres tiers con sus links `/r/patreon-1..3` y el dueño. Volver a correrlo no toca lo que ya existe, y si ya hay un dueño no crea otro: los admins nuevos se crean desde el panel. El seed de demo (`db:seed:demo`) **no** se usa en producción: solo funciona con storage local.

Si el build falla porque Render instala las dependencias por su cuenta con otra versión de pnpm, la variable `SKIP_INSTALL_DEPS=true` (ya está en `render.yaml`) lo evita. Es un workaround que propone la comunidad de Render, no documentación oficial.

## 6. Cloudflare: DNS y correo

### DNS

1. **DNS → Records**:
   - borrar los registros `AAAA` del dominio, porque Render no soporta IPv6;
   - `CNAME` `@` → `galeria-nightdaro.onrender.com`;
   - `CNAME` `www` → `galeria-nightdaro.onrender.com`.
2. Los dos en **DNS only** (nube gris) para que Render verifique el dominio y emita el certificado. Conviene dejarlos así: con el proxy de Cloudflare se encadenan dos Cloudflare y hay que volver a validar de dónde sale la IP del visitante (sección 7).
3. **SSL/TLS → Overview**: modo **Full**.
4. En Render, **Settings → Custom Domains**: esperar a que `www.nightdaro.com` y `nightdaro.com` figuren como verificados con certificado. Render redirige `nightdaro.com` a `www`.

### Email Routing

1. **Email → Email Routing → Get started**: Cloudflare agrega los registros MX y SPF.
2. **Destination addresses**: agregar el correo personal de Daro y confirmarlo desde el mail que llega.
3. **Custom addresses**: `contacto@nightdaro.com` → ese destino. Es el contacto que muestra el pie de la galería (`CONTACT_EMAIL`).

## 7. Verificación

1. `curl https://www.nightdaro.com/api/health` responde `{"status":"ok"}`.
2. `https://nightdaro.com` redirige a `https://www.nightdaro.com`, con candado válido.
3. La portada muestra la puerta +18. En `/apoyar` aparecen los tres tiers del seed, y cada botón pasa por `/r/patreon-…` hasta Patreon.
4. Entrar en `/login` con el admin del seed.
5. **IP del visitante:** con la sesión iniciada, abrir `https://www.nightdaro.com/api/admin/ip-check`.
   - `resolved` tiene que ser **tu IP pública** (comparala con cualquier sitio tipo "cuál es mi IP"). Si muestra una IP de Render o de Cloudflare, el rate limit del login y los visitantes únicos quedarían mal: probá `CLIENT_IP_HEADER=true-client-ip` y volvé a mirar.
   - Además, comprobá que **no se puede falsear**: copiá la cookie de sesión del navegador (`__Secure-authjs.session-token`) y corré `curl -s -H "CF-Connecting-IP: 1.2.3.4" -H "Cookie: __Secure-authjs.session-token=…" https://www.nightdaro.com/api/admin/ip-check`. `resolved` **no** puede ser `1.2.3.4`. Si lo es, el header no lo pisa Cloudflare y cualquiera podría saltear el rate limit: borrá `CLIENT_IP_HEADER` y avisá.
6. Subir una imagen de prueba desde `/admin/subir`: tienen que aparecer `original.*` en `nightdaro-originals` y `thumb.webp` y `preview.webp` en `nightdaro-public`. La miniatura se ve en Galería, y la URL de la imagen vence en 1 hora.
7. Un error forzado aparece en Sentry, sin IP ni cookies.

## 8. Backups de Neon

Neon guarda el historial de cambios de la base y permite volver a cualquier momento dentro de esa **ventana de historial** (*instant restore*). En el plan Free la ventana es de **6 horas**, y se ve en **Settings → Postgres → History window**.

Esto tiene una consecuencia: un error que se descubre más de 6 horas después ya no se puede deshacer. Antes de algo riesgoso, como una migración que borra datos o una carga grande, conviene hacer una copia a mano:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=nightdaro-$(date +%F).dump
```

### Probar la restauración (una vez, sin tocar producción)

1. Anotar la hora actual, por ejemplo 14:00.
2. En `/admin/pagina`, cambiar el texto de presentación y guardar.
3. En Neon, entrar a **Backup & Restore**, elegir la rama principal (`production` o `main`, según cómo se llame en tu proyecto), poner la hora anotada y tocar **Restore**. En el aviso de confirmación, elegir **Preview data**, **no** Restore.
4. En **Query data**, correr `select bio from site_settings;`: tiene que aparecer el texto **anterior** al cambio.
5. Tocar **Cancel**, y en `/admin/pagina` volver a dejar el texto original.

Si el paso 4 muestra el texto viejo, la restauración funciona. Para restaurar de verdad se hace lo mismo, pero se toca **Restore**. Neon guarda el estado actual en una rama `<rama>_old_<fecha>` por si hay que volver atrás, y la app no necesita cambios porque la cadena de conexión es la misma.

| Fecha de la prueba | Quién | Resultado |
| --- | --- | --- |
| _pendiente_ | | |

## 9. Patreon (opcional)

1. Con la cuenta de Daro, entrar a https://www.patreon.com/portal/registration/register-clients y crear un cliente:
   - **API version:** 2.
   - **Redirect URIs:** `https://www.nightdaro.com/api/patreon/callback`, exacta.
   - Nombre, descripción e ícono: libres. El dragón de `public/brand/` sirve.
2. Patreon muestra el **Client ID** y el **Client Secret**. Van en Render (**Environment**) como `PATREON_CLIENT_ID` y `PATREON_CLIENT_SECRET`. Nunca se pegan en un chat ni en el repo.
3. `PATREON_TOKEN_KEY` cifra los tokens guardados. Render lo genera solo (`generateValue`). Si no aparece después de sincronizar el Blueprint, cargar a mano cualquier texto aleatorio largo. Si se cambia, la conexión guardada ya no se puede leer y hay que volver a conectar.
4. Redesplegar. En `/admin/links` aparece **Conectar Patreon**: Daro lo toca, acepta en Patreon y vuelve al panel con "Patreon quedó conectado".

