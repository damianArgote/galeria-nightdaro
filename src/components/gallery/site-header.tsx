import Link from "next/link";

export function SiteHeader({ name }: { name: string }) {
  const [first, ...rest] = name.toUpperCase().split(/(?=DARO)/);
  return (
    <header className="sticky top-0 z-40 border-b border-[#2e2470] bg-[#07041a]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-[22px] tracking-[0.02em]">
          {first}
          <b className="font-normal text-brand-violet">{rest.join("")}</b>
        </Link>
        <nav aria-label="Secciones" className="hidden gap-6 text-sm text-[#aaa4d8] sm:flex">
          <Link href="/" className="hover:text-paper">
            Galería
          </Link>
          <Link href="/timelapses" className="hover:text-paper">
            Timelapses
          </Link>
          <Link href="/apoyar" className="hover:text-paper">
            Apoyar
          </Link>
        </nav>
        <Link href="/apoyar" className="gallery-cta px-4 py-2 text-sm">
          Patreon
        </Link>
      </div>
    </header>
  );
}
