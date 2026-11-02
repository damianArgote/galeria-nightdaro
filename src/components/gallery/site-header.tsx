import Link from "next/link";
import { messages, type Locale } from "./i18n";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader({ name, locale }: { name: string; locale: Locale }) {
  const t = messages[locale].header;
  const [first, ...rest] = name.toUpperCase().split(/(?=DARO)/);
  return (
    <header className="sticky top-0 z-40 border-b border-[#2e2470] bg-[#07041a]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-[22px] tracking-[0.02em]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimization needed */}
          <img src="/brand/dragon.svg" alt="" width={40} height={40} className="size-10" />
          <span>
            {first}
            <b className="font-normal text-brand-violet">{rest.join("")}</b>
          </span>
        </Link>
        <nav aria-label={t.sections} className="hidden gap-[22px] text-sm text-[#aaa4d8] sm:flex">
          <Link href="/#galeria" className="hover:text-paper">
            {t.gallery}
          </Link>
          <Link href="/apoyar" className="hover:text-paper">
            {t.subscription}
          </Link>
          <Link href="/#proteccion" className="hover:text-paper">
            {t.protection}
          </Link>
          <a href="#redes" className="hover:text-paper">
            {t.socials}
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher locale={locale} />
          <Link href="/apoyar" className="gallery-cta px-4 py-2 text-sm">
            Patreon
          </Link>
        </div>
      </div>
    </header>
  );
}
