/**
 * Guided tours of the panel (driver.js). Each step points at an element marked with
 * `data-tour="<id>"`; a step whose element is not on screen (an empty list, Patreon not
 * connected) is skipped, so a tour never breaks on a missing piece.
 */
export interface TourStep {
  /** `data-tour` id of the element; none means a centered message. */
  target?: string;
  title: string;
  description: string;
}

const MENU: TourStep[] = [
  {
    target: "nav",
    title: "El menú del panel",
    description:
      "Desde acá vas a cada sección. Todo lo que cambiás se guarda al instante y la galería pública se actualiza en segundos.",
  },
  {
    target: "tour-button",
    title: "Este tutorial",
    description:
      "Cada sección tiene el suyo. Si te olvidás de algo, tocá «Ver tutorial» y lo repasás cuando quieras.",
  },
];

export const TOURS: Record<string, TourStep[]> = {
  "/admin": [
    {
      title: "Te damos la bienvenida al panel de NightDaro",
      description:
        "Acá manejás la galería: subís obras, elegís qué se publica, editás la página y mirás quién la visita. Te muestro lo principal en un minuto.",
    },
    ...MENU,
    {
      target: "range",
      title: "El período",
      description: "Elegí los últimos 7, 14 o 30 días, o un rango de fechas a mano.",
    },
    {
      target: "stats",
      title: "Los números clave",
      description:
        "Visitas, visitantes únicos, cuántos pasaron la puerta +18 y cuántos tocaron un botón de Patreon. Nunca se guardan IPs.",
    },
    {
      target: "daily",
      title: "Día por día",
      description:
        "Visitas y clics de cada día, en hora de Buenos Aires. Abajo los podés ver como tabla.",
    },
    {
      target: "tier-clicks",
      title: "Clics por tier",
      description: "Qué nivel de suscripción eligen más los visitantes.",
    },
    {
      target: "patreon",
      title: "Patreon",
      description:
        "Altas, bajas, patrons activos e ingreso mensual estimado, al lado de los clics de cada tier.",
    },
    {
      target: "artwork-clicks",
      title: "Obras que llevan a Patreon",
      description:
        "Cuántas veces tocaron «Ver completa en Patreon» en cada obra. Para que cuente, cargá el link del post en Galería → editar.",
    },
    {
      target: "top-artworks",
      title: "Obras más vistas",
      description: "Las que más abren en la galería: una buena pista de qué subir.",
    },
    {
      target: "public-link",
      title: "Ver la página pública",
      description: "Abre la galería como la ve un visitante.",
    },
  ],
  "/admin/subir": [
    {
      target: "upload-kind",
      title: "Qué vas a subir",
      description:
        "Una obra terminada, una en proceso o un timelapse (video). Cada tipo va a su pestaña en la galería.",
    },
    {
      target: "upload-file",
      title: "El archivo",
      description:
        "Arrastralo o tocá para elegirlo. El original queda guardado en privado; la galería solo muestra una versión en baja resolución con marca de agua. En un timelapse podés sumar una portada; si no, se usa un cuadro del video cuando Bunny termina de procesarlo.",
    },
    {
      target: "upload-rating",
      title: "El rating",
      description:
        "Apto para todos se ve sin la puerta +18. Sugerente y explícita solo después de aceptarla. Una explícita nunca se muestra limpia: va la versión censurada que subas o un desenfoque fuerte.",
    },
    {
      target: "upload-adults",
      title: "Confirmación",
      description: "Obligatoria: todos los personajes tienen que ser adultos.",
    },
    {
      target: "upload-submit",
      title: "Queda como borrador",
      description: "Nada se publica solo: la revisás y la publicás desde Galería.",
    },
  ],
  "/admin/galeria": [
    {
      target: "gallery-tabs",
      title: "Por tipo",
      description: "Terminadas, en proceso y timelapses, como las pestañas de la galería pública.",
    },
    {
      target: "gallery-list",
      title: "El orden de la galería",
      description:
        "Arrastrá una obra desde la manija para cambiar su lugar: la galería pública muestra este mismo orden.",
    },
    {
      target: "gallery-row-actions",
      title: "Cada obra",
      description:
        "Editá el título, la descripción, el rating o el link a su post de Patreon (así «Ver completa en Patreon» lleva a ese post); publicala, ocultala o borrala. Con «Subir imagen» o «Cambiar imagen» le ponés o reemplazás la imagen (en las explícitas, también la versión censurada); en los timelapses es la portada.",
    },
    {
      target: "gallery-from-patreon",
      title: "Borradores desde Patreon",
      description:
        "Cuando Daro publica en Patreon, acá aparece un borrador con el título y el link al post. Patreon no siempre manda la imagen: subila con «Subir imagen», junto con la versión censurada si es explícita, elegí el rating y recién ahí publicalo.",
    },
    {
      target: "gallery-new",
      title: "Una obra nueva",
      description: "Te lleva a Subir.",
    },
  ],
  "/admin/pagina": [
    {
      target: "page-texts",
      title: "Nombre y presentación",
      description:
        "El texto de presentación sale en la portada. El título y la descripción para buscadores son lo que muestran Google y las redes al compartir el link.",
    },
    {
      target: "page-theme",
      title: "Color de acento",
      description: "El color principal de la galería pública.",
    },
    {
      target: "page-gate",
      title: "Puerta +18",
      description:
        "Mientras esté activa, quien no la acepta solo ve las obras aptas para todos. Dejala activa.",
    },
    {
      target: "page-socials",
      title: "Redes",
      description: "Los links del pie de la página. Dejá vacía la red que no uses.",
    },
    {
      target: "page-save",
      title: "Guardar",
      description: "Los cambios se ven en la galería en unos segundos.",
    },
  ],
  "/admin/links": [
    {
      target: "links-patreon",
      title: "Patreon",
      description:
        "Conectá la cuenta de Daro para ver altas, bajas e ingresos en el Resumen, y para que cada post nuevo de Patreon llegue a Galería como borrador. No publica nada en Patreon ni guarda datos de los fans.",
    },
    {
      target: "links-patreon-sync",
      title: "Sincronizar con Patreon",
      description:
        "Para los posts que ya estaban en Patreon antes de conectar: los vinculás con sus obras o los traés como borradores, después de revisarlos.",
    },
    {
      target: "links-tiers",
      title: "Tiers",
      description:
        "Los niveles de /apoyar: nombre, precio, link a Patreon y beneficios, uno por línea. Marcá uno como «El más elegido».",
    },
    {
      target: "links-tracking",
      title: "Links de seguimiento",
      description:
        "Cada link /r/{código} cuenta los clics y redirige. Usalos en redes para saber de dónde llega la gente.",
    },
  ],
  "/admin/patreon": [
    {
      target: "sync-suggested",
      title: "Coinciden por título",
      description:
        "Posts de Patreon que parecen ser una obra que ya está en la galería. Revisá la obra elegida (podés cambiarla) y tocá «Vincular»: así «Ver completa en Patreon» lleva a ese post.",
    },
    {
      target: "sync-missing",
      title: "Sin obra en la galería",
      description:
        "Marcá los posts que querés traer como borrador. Llegan explícitos y desenfocados: después elegís el rating y los publicás desde Galería. Si alguno ya está con otro nombre, vinculalo a mano más abajo.",
    },
  ],
  "/admin/usuarios": [
    {
      target: "users-create",
      title: "Sumar un admin",
      description:
        "Escribí su usuario y el panel te muestra una contraseña temporal una sola vez. Pasásela por un canal privado: al entrar elige la suya.",
    },
    {
      target: "users-list",
      title: "Los admins",
      description:
        "Si alguien olvida su contraseña, reseteala. Si alguien ya no tiene que entrar, desactivalo: pierde el acceso al instante. Solo vos, como dueño, ves esta sección.",
    },
  ],
};
