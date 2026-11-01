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
        <nav aria-label="Secciones" className="hidden gap-[22px] text-sm text-[#aaa4d8] sm:flex">
          <Link href="/#galeria" className="hover:text-paper">
            Galería
          </Link>
          <Link href="/apoyar" className="hover:text-paper">
            Suscripción
          </Link>
          <Link href="/#proteccion" className="hover:text-paper">
            Protección
          </Link>
          <a href="#redes" className="hover:text-paper">
            Redes
          </a>
        </nav>
        <Link href="/apoyar" className="gallery-cta px-4 py-2 text-sm">
          Patreon
        </Link>
      </div>
    </header>
  );
}
