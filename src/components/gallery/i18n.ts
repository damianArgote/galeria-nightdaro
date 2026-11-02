/**
 * Copy of the public gallery in each language. English is the default; Spanish is opt-in through
 * the language switcher (lang cookie). The admin panel stays in Spanish and does not use this.
 */
import type { Locale } from "@/core/gallery/locale";

export { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "@/core/gallery/locale";

type Pair = readonly [title: string, text: string];

export type Messages = {
  numberLocale: string;
  languageSwitcher: { label: string; names: Record<Locale, string> };
  header: {
    sections: string;
    gallery: string;
    subscription: string;
    protection: string;
    socials: string;
  };
  footer: { rights: string; contact: string };
  ageGate: { title: string; body: string; enter: string; leave: string };
  shield: string;
  hero: { bannerAlt: string; unlock: string; viewGallery: string; tags: string; marquee: string[] };
  gallery: {
    eyebrow: string;
    title: string;
    intro: string;
    tabsLabel: string;
    tabs: { finished: string; wip: string; timelapse: string };
    empty: string;
  };
  card: {
    explicit: string;
    wip: string;
    public: string;
    censored: string;
    watermark: string;
  };
  lightbox: {
    close: string;
    explicitKind: string;
    timelapseKind: string;
    previewKind: string;
    explicitText: string;
    previewText: string;
    details: string;
  };
  patreonButton: string;
  artwork: { back: string; rating: { sfw: string; suggestive: string; explicit: string } };
  protection: {
    eyebrow: string;
    title: string;
    activeTitle: string;
    active: Pair[];
    goodToKnowTitle: string;
    goodToKnow: Pair[];
  };
  support: {
    metaTitle: string;
    eyebrow: string;
    title: string;
    empty: string;
    highlighted: string;
    perMonth: string;
    join: (tier: string) => string;
    soon: string;
    note: string;
  };
};

export const messages: Record<Locale, Messages> = {
  en: {
    numberLocale: "en-US",
    languageSwitcher: { label: "Language", names: { en: "English", es: "Español" } },
    header: {
      sections: "Sections",
      gallery: "Gallery",
      subscription: "Subscription",
      protection: "Protection",
      socials: "Socials",
    },
    footer: {
      rights:
        "All illustrations are original work or fan art of adult characters. Redistribution is prohibited.",
      contact: "Contact:",
    },
    ageGate: {
      title: "Adult content",
      body: "This gallery contains anime and fantasy illustrations with nudity and sexual themes. All characters are adults. To enter, confirm that you are 18 or older and that viewing this content is legal where you live.",
      enter: "I am 18 or older, enter",
      leave: "Leave",
    },
    shield: "Protected content · return to the window",
    hero: {
      bannerAlt: "NightDaro · Ink, pin-up, fantasy +18 · Uncensored anime illustration",
      unlock: "Unlock everything on Patreon",
      viewGallery: "View the gallery",
      tags: "Tags",
      marquee: [
        "新作毎週",
        "NEW ART EVERY WEEK",
        "十八禁",
        "ADULTS ONLY",
        "パトレオン限定",
        "PATREON EXCLUSIVE",
      ],
    },
    gallery: {
      eyebrow: "Gallery",
      title: "Fresh off the drawing board",
      intro:
        "Public previews are low resolution and watermarked. Anything marked +18 can only be seen in full on Patreon.",
      tabsLabel: "Content type",
      tabs: { finished: "Finished", wip: "In progress", timelapse: "Timelapses" },
      empty: "No artworks in this tab yet.",
    },
    card: {
      explicit: "+18 · Patreon only",
      wip: "In progress",
      public: "Public",
      censored: "Censored version · full on Patreon",
      watermark: "NIGHTDARO · @nightdaro · preview · ",
    },
    lightbox: {
      close: "Close",
      explicitKind: "+18 · Patreon exclusive",
      timelapseKind: "Timelapse",
      previewKind: "Preview · low resolution",
      explicitText:
        "This piece is not published in full on the web. On Patreon you can see it uncensored and in high resolution.",
      previewText:
        "Low-resolution, watermarked preview. The high-resolution version without watermark is on Patreon.",
      details: "Artwork details",
    },
    patreonButton: "See it in full on Patreon",
    artwork: {
      back: "← Gallery",
      rating: {
        sfw: "Suitable for all audiences",
        suggestive: "Suggestive content +18",
        explicit: "+18 · The full version is only on Patreon",
      },
    },
    protection: {
      eyebrow: "Protection",
      title: "How the content is protected",
      activeTitle: "Active in this gallery",
      active: [
        ["18+ gate", "Age confirmation before showing any suggestive content."],
        ["No right-click or dragging", "Artworks cannot be saved or dragged to the desktop."],
        ["Blur when you leave", "If the window loses focus or you switch tabs, the gallery blurs."],
        ["Watermark on every view", "Previews carry NightDaro's signature as a tiled pattern."],
        [
          "Explicit art is never public",
          "The web only has censored or blurred versions. The full art lives on Patreon.",
        ],
      ],
      goodToKnowTitle: "Good to know",
      goodToKnow: [
        [
          "Small, expiring images",
          "Previews are low resolution and come from signed links that expire in one hour.",
        ],
        ["Adult characters, always", "Every artwork is original or fan art of adult characters."],
        [
          "No screenshot can be blocked 100%",
          "That is why the web never has the full version: it is only on Patreon, in high resolution and without watermark.",
        ],
      ],
    },
    support: {
      metaTitle: "Support",
      eyebrow: "Subscription",
      title: "Choose your tier",
      empty: "Soon you will be able to subscribe from here.",
      highlighted: "Most popular",
      perMonth: "/ month",
      join: (tier) => `Join as ${tier}`,
      soon: "Coming soon",
      note: "Each button takes you to the matching tier on the platform.",
    },
  },
  es: {
    numberLocale: "es-AR",
    languageSwitcher: { label: "Idioma", names: { en: "English", es: "Español" } },
    header: {
      sections: "Secciones",
      gallery: "Galería",
      subscription: "Suscripción",
      protection: "Protección",
      socials: "Redes",
    },
    footer: {
      rights:
        "Todas las ilustraciones son obra original o fan art de personajes adultos. Prohibida su redistribución.",
      contact: "Contacto:",
    },
    ageGate: {
      title: "Contenido para adultos",
      body: "Esta galería tiene ilustraciones anime y fantasía con desnudos y temática sexual. Todos los personajes son adultos. Para entrar confirmá que tenés 18 años o más y que es legal ver este contenido donde vivís.",
      enter: "Tengo 18 o más, entrar",
      leave: "Salir",
    },
    shield: "Contenido protegido · volvé a la ventana",
    hero: {
      bannerAlt: "NightDaro · Tinta, pin-up, fantasía +18 · Ilustración anime sin censura",
      unlock: "Desbloquear todo en Patreon",
      viewGallery: "Ver la galería",
      tags: "Etiquetas",
      marquee: [
        "新作毎週",
        "NUEVO ARTE CADA SEMANA",
        "十八禁",
        "SOLO ADULTOS",
        "パトレオン限定",
        "EXCLUSIVO PATREON",
      ],
    },
    gallery: {
      eyebrow: "Galería",
      title: "Lo último de la mesa de dibujo",
      intro:
        "Las vistas previas públicas son de baja resolución y llevan marca de agua. Lo marcado +18 solo se ve completo en Patreon.",
      tabsLabel: "Tipo de contenido",
      tabs: { finished: "Terminado", wip: "En proceso", timelapse: "Timelapses" },
      empty: "Todavía no hay obras en esta pestaña.",
    },
    card: {
      explicit: "+18 · Solo en Patreon",
      wip: "En proceso",
      public: "Público",
      censored: "Versión censurada · completa en Patreon",
      watermark: "NIGHTDARO · @nightdaro · vista previa · ",
    },
    lightbox: {
      close: "Cerrar",
      explicitKind: "+18 · Exclusivo de Patreon",
      timelapseKind: "Timelapse",
      previewKind: "Vista previa · baja resolución",
      explicitText:
        "Esta pieza no se publica completa en la web. En Patreon la ves sin censura y en alta resolución.",
      previewText:
        "Vista en baja resolución con marca de agua. La versión en alta y sin marca está en Patreon.",
      details: "Ficha de la obra",
    },
    patreonButton: "Ver completa en Patreon",
    artwork: {
      back: "← Galería",
      rating: {
        sfw: "Apta para todo público",
        suggestive: "Contenido sugerente +18",
        explicit: "+18 · La versión completa solo está en Patreon",
      },
    },
    protection: {
      eyebrow: "Protección",
      title: "Cómo se protege el contenido",
      activeTitle: "Activo en esta galería",
      active: [
        ["Puerta +18", "Confirmación de edad antes de mostrar cualquier contenido sugerente."],
        [
          "Sin clic derecho ni arrastre",
          "Las obras no se pueden guardar ni arrastrar al escritorio.",
        ],
        [
          "Desenfoque al salir",
          "Si la ventana pierde el foco o cambiás de pestaña, la galería se desenfoca.",
        ],
        [
          "Marca de agua en cada vista",
          "Las vistas previas llevan la firma de NightDaro en mosaico.",
        ],
        [
          "Lo explícito nunca es público",
          "En la web solo hay versiones censuradas o borrosas. Lo completo vive en Patreon.",
        ],
      ],
      goodToKnowTitle: "Lo que hay que saber",
      goodToKnow: [
        [
          "Imágenes chicas y con vencimiento",
          "Las vistas previas son de baja resolución y salen de enlaces firmados que vencen en una hora.",
        ],
        [
          "Personajes adultos, siempre",
          "Todas las obras son originales o fan art de personajes adultos.",
        ],
        [
          "Ninguna captura se puede bloquear al 100%",
          "Por eso la web nunca tiene la versión completa: está solo en Patreon, en alta y sin marca.",
        ],
      ],
    },
    support: {
      metaTitle: "Apoyar",
      eyebrow: "Suscripción",
      title: "Elegí tu nivel",
      empty: "Pronto vas a poder suscribirte desde acá.",
      highlighted: "El más elegido",
      perMonth: "/ mes",
      join: (tier) => `Unirme como ${tier}`,
      soon: "Muy pronto",
      note: "Cada botón lleva al nivel correspondiente de la plataforma.",
    },
  },
};
