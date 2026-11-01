# Deuda técnica: lo que falta para igualar los mockups

Pasos para hacer después del Paso 12, con el mismo formato que la Parte 2 del plan: cada paso es un PR desde `main` en una rama `feat/<paso>`, y termina cuando cumple su "Hecho cuando" y el CI está en verde.

Referencias visuales:

- Galería pública: https://claude.ai/artifact/QcXWt3eLbB5coacF9Yo6pc
- Panel (estudio): https://claude.ai/artifact/7RiiChsEjdVKGgTN7n29gQ

Todos estos pasos necesitan datos que hoy el modelo no tiene o pantallas que todavía no existen. El estilo visual de ambos mockups ya está aplicado.

| Paso | Qué agrega | Cambia el modelo |
| --- | --- | --- |
| 13 | Banner subido desde el panel | No (usa `site_settings.banner_media_id`) |
| 14 | Contenido editable de la portada | Sí: `site_settings` |
| 15 | Duración de los timelapses | Sí: `media_assets` |
| 16 | Avance de las obras en proceso | Sí: `artworks` |
| 17 | Beneficios y tier destacado (**hecho**) | Sí: `tiers` |
| 18 | Resumen ampliado | Sí: tabla nueva `activity` |
| 19 | Subida ampliada | Sí: `artworks` |
| 20 | Galería del panel ampliada | No |
| 21 | Página del panel ampliada | Sí: `site_settings` |
| 22 | Foco atrapado en el lightbox | No |

### Paso 13. Banner subido desde el panel

```text
Leé docs/arquitectura.md, secciones "Pipeline de imágenes y protección" y "Modelo de datos" (site_settings.banner_media_id), y mirá el hero del mockup de la galería.

- Caso de uso UploadSiteBanner en src/core/site: reutiliza el pipeline de UploadArtworkImage (magic bytes, máximo 30 MB, original sin EXIF en originals) y genera una variante de 1600 × 685 WebP para public-media. Guarda el media_asset (sin artwork) y lo apunta desde site_settings.banner_media_id; el banner anterior se borra con sus archivos.
- media_assets.artwork_id pasa a ser opcional, o se crea una tabla aparte para medios del sitio: decidilo y documentalo en el mismo PR.
- /admin/pagina: reemplazar el placeholder por una zona para arrastrar la imagen, con vista previa.
- La galería sirve el banner por una ruta /media/site/banner que firma en cada pedido, como /media/{id}/{variant}. Si no hay banner subido, sigue usando /banner.jpg de public/.
- Tests: subir un banner reemplaza al anterior y borra sus archivos; la portada muestra el banner subido.

Rama feat/banner desde main, PR a main.

Hecho cuando: Daro sube un banner desde el panel y aparece en la portada pública.
```

### Paso 14. Contenido editable de la portada

```text
Leé docs/arquitectura.md, sección "Modelo de datos" (site_settings), y mirá el hero y la cinta del mockup de la galería.

- Migración: site_settings suma home jsonb con tags (text[], hasta 8), cta_label (texto del botón principal), marquee (lista de frases de la cinta) y featured_artwork_id (obra destacada, opcional).
- UpdateSiteSettings valida esos campos con Zod. La obra destacada tiene que estar publicada y ser sfw: la portada la ven todos.
- /admin/pagina: campos para etiquetas, texto del botón, frases de la cinta y un selector de obra destacada.
- Portada: usa las etiquetas configuradas (si no hay, las más usadas de las obras, como hoy), el texto del botón, la cinta configurada y la tarjeta de obra destacada con el globo "見ちゃダメ…♡" y el sello 夜達 del mockup.
- Tests: se rechaza una obra destacada que no es sfw o no está publicada; la portada muestra los textos configurados.

Rama feat/portada desde main, PR a main.

Hecho cuando: cambiar etiquetas, botón, cinta y obra destacada en el panel se ve en la portada.
```

### Paso 15. Duración de los timelapses

```text
Leé docs/arquitectura.md, sección "Pipeline de imágenes y protección" (Timelapses), y mirá las tarjetas de video del mockup.

- Migración: media_assets suma duration_seconds integer.
- SyncVideoStatus guarda la duración cuando Bunny marca el video como listo (campo length de GET /library/{id}/videos/{videoId}; verificalo en la documentación de Bunny Stream antes de usarlo).
- Las tarjetas y el lightbox de /timelapses muestran la duración (mm:ss o h:mm:ss) abajo a la derecha, como en el mockup.
- Tests: el sync guarda la duración; formateo de 0:45, 12:40 y 1:02:03.

Rama feat/duracion-timelapses desde main, PR a main.

Hecho cuando: un timelapse listo muestra su duración en la galería.
```

### Paso 16. Avance de las obras en proceso

```text
Leé docs/arquitectura.md, sección "Modelo de datos" (artworks), y mirá "En proceso" en los dos mockups.

- Migración: artworks suma stage (boceto, entintado, color base, sombras y luces) y progress (0 a 100), solo con sentido para kind = wip.
- Create/UpdateArtwork validan stage y progress con Zod y los rechazan para obras que no están en proceso.
- Panel (subir y editar): selector de etapa y deslizador de avance.
- Galería: barra de avance y etapa en las tarjetas de "En proceso", como en el mockup.
- Tests: validación por tipo; la barra refleja el porcentaje.

Rama feat/avance desde main, PR a main.

Hecho cuando: una obra en proceso muestra su etapa y su avance en la galería.
```

### Paso 17. Beneficios de los tiers y tier destacado

> **Hecho** antes del lanzamiento, a pedido, para mostrar los beneficios de los tiers de Patreon. Al destacar un tier se desmarca el anterior, y la base lo garantiza con un índice único parcial.

```text
Leé docs/arquitectura.md, secciones "Modelo de datos" (tiers) e "Integraciones", y mirá los tiers del mockup.

- Migración: tiers suma benefits text[] (hasta 6, máximo 80 caracteres cada uno) y highlighted boolean (como máximo uno destacado).
- /admin/links: editor de beneficios por tier y marca de destacado.
- /apoyar: lista de beneficios con el ✦ verde y el destacado "El más elegido" según el dato, no según la posición del medio.
- Tests: solo un tier destacado; los beneficios se muestran en orden.

Rama feat/beneficios desde main, PR a main.

Hecho cuando: los beneficios y el destacado que se cargan en el panel se ven en /apoyar.
```

### Paso 18. Resumen ampliado

```text
Leé docs/arquitectura.md, secciones "Modelo de datos" (events) e "Integraciones", y mirá el Resumen del mockup del panel. Antes de dibujar, cargá el skill de visualización de datos y validá la paleta.

- Cada indicador muestra la variación contra el período anterior de la misma duración (▲/▼ con porcentaje) y un minigráfico de la serie diaria.
- Embudo del visitante: visitas → pasaron la puerta → vieron una obra → clic a un tier, con la caída entre etapas.
- Obras que más llevan a Patreon: vistas, clics desde su lightbox o ficha (registrar el artwork de origen en el clic de /r/ con un parámetro firmado) y conversión.
- Actividad reciente: migración con una tabla activity (tipo, texto, created_at) que alimentan publicar, subir, cambiar precios y picos de clics.
- No combinar visitas y clics en un gráfico con dos ejes: dos gráficos o índice común.
- Tests: variación con período anterior vacío; el embudo nunca sube entre etapas.

Rama feat/resumen-ampliado desde main, PR a main.

Hecho cuando: el Resumen muestra variaciones, embudo, conversión por obra y actividad reciente.
```

### Paso 19. Subida ampliada

```text
Leé docs/arquitectura.md, secciones "Pipeline de imágenes y protección" y "Acceso al panel", y mirá la pantalla "Subir" del mockup del panel.

- Vista previa "Así se ve en la galería" junto al formulario: la tarjeta como la verá el visitante sin la puerta (bloqueada si es +18), más un checklist de lo que falta.
- Programar la publicación: artworks.scheduled_at (migración) y un route handler /api/cron/publish protegido con un secreto, que Render llama cada 5 minutos para publicar lo vencido.
- Nivel mínimo de Patreon: artworks.min_tier_id (migración), que la galería muestra como "Desde {tier}".
- Tests: una obra programada no se ve antes de su fecha y se publica después; el cron rechaza pedidos sin el secreto.

Rama feat/subida-ampliada desde main, PR a main.

Hecho cuando: se puede programar una obra y aparece sola en la galería a su hora.
```

### Paso 20. Galería del panel ampliada

```text
Mirá la pantalla "Galería" del mockup del panel.

- Buscador por título en /admin/galeria, que filtra la pestaña actual sin recargar.
- Cada fila muestra las vistas y los clics de la obra en los últimos 30 días, usando los datos de events.
- El reordenamiento sigue funcionando con el buscador vacío; con un filtro activo, arrastrar queda deshabilitado y se explica por qué.
- Tests: el filtro por título; los números de la fila coinciden con el Resumen.

Rama feat/galeria-panel desde main, PR a main.

Hecho cuando: se puede buscar una obra y ver sus vistas y clics en la fila.
```

### Paso 21. Página del panel ampliada

```text
Leé docs/arquitectura.md, sección "Seguridad, puerta +18 y moderación", y mirá la pantalla "Página pública" del mockup del panel.

- Vista previa en vivo de la portada, al costado del formulario, que se actualiza mientras se escribe.
- Migración: site_settings suma protection jsonb con los switches del mockup: bloquear clic derecho y arrastre, desenfocar al cambiar de pestaña y ocultar de buscadores (noindex en páginas e imágenes).
- La galería aplica cada switch: los disuasivos y el desenfoque se pueden apagar; noindex agrega robots noindex, noimageindex.
- Tests: con noindex activado, la portada lleva la meta robots; con el desenfoque apagado, perder el foco no desenfoca.

Rama feat/pagina-ampliada desde main, PR a main.

Hecho cuando: los switches de protección del panel cambian el comportamiento de la galería.
```

### Paso 22. Foco atrapado en el lightbox

```text
- El lightbox de la galería atrapa el foco (Tab y Shift+Tab no salen del diálogo), deja inerte el resto de la página mientras está abierto y devuelve el foco a la tarjeta al cerrarse, como ya hace el modal +18.
- Test de Playwright: con el lightbox abierto, Tab nunca enfoca algo fuera del diálogo; al cerrar, el foco vuelve a la tarjeta.

Rama fix/lightbox-foco desde main, PR a main.

Hecho cuando: el lightbox se puede usar solo con teclado sin perder el foco.
```
