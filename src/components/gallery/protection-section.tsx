const ACTIVE = [
  ["Puerta +18", "Confirmación de edad antes de mostrar cualquier contenido sugerente."],
  ["Sin clic derecho ni arrastre", "Las obras no se pueden guardar ni arrastrar al escritorio."],
  [
    "Desenfoque al salir",
    "Si la ventana pierde el foco o cambiás de pestaña, la galería se desenfoca.",
  ],
  ["Marca de agua en cada vista", "Las vistas previas llevan la firma de NightDaro en mosaico."],
  [
    "Lo explícito nunca es público",
    "En la web solo hay versiones censuradas o borrosas. Lo completo vive en Patreon.",
  ],
] as const;

const GOOD_TO_KNOW = [
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
] as const;

function Checks({
  items,
  mark,
  tone,
}: {
  items: readonly (readonly [string, string])[];
  mark: string;
  tone: string;
}) {
  return (
    <ul className="grid gap-3">
      {items.map(([title, text]) => (
        <li key={title} className="grid grid-cols-[22px_1fr] gap-2.5">
          <b aria-hidden className={tone}>
            {mark}
          </b>
          <div>
            <b className="block">{title}</b>
            <span className="text-sm text-[#aaa4d8]">{text}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** How the gallery protects the art (the mockup's "Protección" section, for visitors). */
export function ProtectionSection() {
  return (
    <section id="proteccion" className="py-[72px]">
      <div className="mx-auto max-w-[1180px] px-4">
        <p className="font-label text-xs tracking-[0.14em] text-brand-green uppercase">
          <span className="mr-2.5 font-brush text-[15px] tracking-[0.2em] text-paper normal-case">
            保護
          </span>
          Protección
        </p>
        <h2 className="mb-7 font-display text-[clamp(34px,5vw,54px)] leading-none">
          Cómo se protege el contenido
        </h2>
        <div className="grid gap-7 md:grid-cols-2">
          <div className="min-w-0 rounded-md border-[3px] border-black bg-[#120c33] p-6 shadow-[6px_6px_0_#000]">
            <h3 className="mb-3.5 font-display text-[22px]">Activo en esta galería</h3>
            <Checks items={ACTIVE} mark="✓" tone="text-brand-green" />
          </div>
          <div className="min-w-0 rounded-md border-[3px] border-black bg-[#120c33] p-6 shadow-[6px_6px_0_#000]">
            <h3 className="mb-3.5 font-display text-[22px]">Lo que hay que saber</h3>
            <Checks items={GOOD_TO_KNOW} mark="!" tone="text-brand-sky" />
          </div>
        </div>
      </div>
    </section>
  );
}
