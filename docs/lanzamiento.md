# Checklist de lanzamiento

La galería se publica cuando todos los puntos están marcados. Cada uno dice dónde se comprueba.

## Infraestructura

- [x] **Dominio:** `https://www.nightdaro.com` responde con certificado válido, y `nightdaro.com` y `http://` redirigen a `www` (comprobado el 01/11/2026).
- [x] **Base de datos:** `/api/health?db=1` responde `"database":"ok"`.
- [ ] **Contraseña de Neon rotada:** la anterior quedó expuesta en un chat.
- [ ] **Backups de Neon probados:** la prueba de `docs/deploy.md`, sección 8, anotada en su tabla.
- [ ] **IP del visitante:** `/api/admin/ip-check` muestra tu IP pública, y la prueba con `CF-Connecting-IP: 1.2.3.4` **no** devuelve `1.2.3.4` (`docs/deploy.md`, sección 7).
- [ ] **Bunny:** una imagen subida desde el panel aparece en `nightdaro-originals` y en `nightdaro-public`, y se ve en la galería.
- [ ] **Sentry sin errores:** un error forzado llega sin IP ni cookies, y después del lanzamiento la lista de issues queda vacía o revisada.

## Seguridad

- [x] **CSP y headers de seguridad** en todas las respuestas (`src/infra/http/security-headers.ts`). Se comprueba con `curl -sI https://www.nightdaro.com | grep -i content-security-policy`.
- [ ] **CSP en producción:** con las DevTools abiertas (pestaña Console), las imágenes de la galería cargan y subir un timelapse real no muestra errores de "Content Security Policy". La CSP se arma **en el build** con `BUNNY_CDN_HOST` y `SENTRY_DSN`: si cambia alguna de las dos, hay que redesplegar (no alcanza con reiniciar).
- [x] **Server Actions:** todas empiezan con `requireAdmin()` y validan con Zod. Lo comprueba `tests/admin-actions-guard.test.ts`, y el login valida en `AuthenticateAdmin`.

## Contenido

- [ ] **Obras cargadas** con su rating correcto: `sfw`, `suggestive` o `explicit`.
- [ ] **Explicit con censura:** cada obra `explicit` tiene su versión censurada; la galería nunca muestra la original.
- [ ] **Tiers reales:** los de Patreon, con su nombre, precio y link de cada nivel. No tienen que quedar los "Tier 1..3" de ejemplo del seed.
- [x] **Imagen de Open Graph:** `public/og.jpg` (1200 × 630, recorte del banner). Se comprueba pegando el link en un chat o en https://www.opengraph.xyz.
- [ ] **Textos del sitio** revisados en `/admin/pagina`: nombre, presentación, título y descripción para buscadores, y redes.

## Publicación

- [ ] Todos los puntos anteriores marcados.
- [ ] Link compartido en las redes de NightDaro.
