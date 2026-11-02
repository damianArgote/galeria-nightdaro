import { messages, type Locale } from "./i18n";

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
export function ProtectionSection({ locale }: { locale: Locale }) {
  const t = messages[locale].protection;
  return (
    <section id="proteccion" className="py-[72px]">
      <div className="mx-auto max-w-[1180px] px-4">
        <p className="font-label text-xs tracking-[0.14em] text-brand-green uppercase">
          <span className="mr-2.5 font-brush text-[15px] tracking-[0.2em] text-paper normal-case">
            保護
          </span>
          {t.eyebrow}
        </p>
        <h2 className="mb-7 font-display text-[clamp(34px,5vw,54px)] leading-none">{t.title}</h2>
        <div className="grid gap-7 md:grid-cols-2">
          <div className="min-w-0 rounded-md border-[3px] border-black bg-[#120c33] p-6 shadow-[6px_6px_0_#000]">
            <h3 className="mb-3.5 font-display text-[22px]">{t.activeTitle}</h3>
            <Checks items={t.active} mark="✓" tone="text-brand-green" />
          </div>
          <div className="min-w-0 rounded-md border-[3px] border-black bg-[#120c33] p-6 shadow-[6px_6px_0_#000]">
            <h3 className="mb-3.5 font-display text-[22px]">{t.goodToKnowTitle}</h3>
            <Checks items={t.goodToKnow} mark="!" tone="text-brand-sky" />
          </div>
        </div>
      </div>
    </section>
  );
}
