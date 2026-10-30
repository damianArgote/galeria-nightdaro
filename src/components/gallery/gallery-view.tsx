import Link from "next/link";
import type { ArtworkKind } from "@/core/artworks/artwork";
import type { Audience } from "@/core/gallery/audience";
import { container } from "@/infra/container";
import { cn } from "@/lib/utils";
import { ArtworkGrid } from "./artwork-grid";

const TABS: { kind: ArtworkKind; href: string; label: string; kanji: string }[] = [
  { kind: "finished", href: "/", label: "Terminado", kanji: "完成" },
  { kind: "wip", href: "/en-proceso", label: "En proceso", kanji: "制作中" },
  { kind: "timelapse", href: "/timelapses", label: "Timelapses", kanji: "動画" },
];

const MARQUEE = [
  "新作毎週",
  "NUEVO ARTE CADA SEMANA",
  "十八禁",
  "SOLO ADULTOS",
  "パトレオン限定",
  "EXCLUSIVO PATREON",
];

/** One tab of the public gallery: hero, tabs (plain links) and the grid. */
export async function GalleryView({ kind, audience }: { kind: ArtworkKind; audience: Audience }) {
  const [settings, artworks] = await Promise.all([
    container.getSiteSettings.execute(),
    container.listPublicGallery.execute({ kind, audience }),
  ]);
  const [first, ...rest] = settings.name.toUpperCase().split(/(?=DARO)/);

  return (
    <>
      <section className="relative overflow-hidden border-b border-[#2e2470] bg-[repeating-conic-gradient(from_0deg_at_78%_42%,#ffffff0b_0deg_1.4deg,transparent_1.4deg_5deg),radial-gradient(900px_500px_at_78%_42%,#3a1a8f_0%,transparent_60%),linear-gradient(180deg,#150b42,#07041a)]">
        <span
          aria-hidden
          className="absolute top-7 right-4 z-[2] hidden font-brush text-[clamp(26px,3.4vw,40px)] tracking-[0.35em] opacity-85 [text-shadow:3px_3px_0_#000] [writing-mode:vertical-rl] md:block"
        >
          夜の画廊
        </span>
        <div className="relative z-[1] mx-auto max-w-[1180px] px-4 pt-14 pb-16">
          <h1 className="my-3.5 font-display text-[clamp(38px,11vw,124px)] leading-none break-words [text-shadow:4px_4px_0_var(--brand-violet),8px_8px_0_var(--brand-sky),0_0_40px_#b14dff99]">
            {first}
            {rest.join("")}
          </h1>
          <span
            aria-hidden
            className="mb-5 block font-brush text-[clamp(18px,2.4vw,26px)] tracking-[0.5em] text-brand-green [text-shadow:0_0_14px_#39ff8899]"
          >
            ナイトダロ
          </span>
          {settings.bio && (
            <p className="mb-6 max-w-[52ch] text-lg text-[#d5d9ee]">{settings.bio}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/apoyar" className="gallery-cta px-5 py-3">
              Desbloquear todo en Patreon
            </Link>
            <a
              href="#galeria"
              className="rounded-full border-[1.5px] border-[#2e2470] px-5 py-3 font-bold text-paper"
            >
              Ver la galería
            </a>
          </div>
        </div>
      </section>

      <div
        aria-hidden
        className="relative z-[5] -my-1.5 -rotate-[1.2deg] overflow-hidden border-y-[3px] border-black bg-gradient-to-r from-brand-violet via-brand-sky to-brand-green text-[#12002a]"
      >
        <div className="flex w-max gap-7 py-2.5 font-display text-lg whitespace-nowrap motion-safe:animate-[marquee_26s_linear_infinite]">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((text, i) => (
            <span
              key={i}
              className={/[一-龯ぁ-んァ-ン]/.test(text) ? "font-brush text-xl" : undefined}
            >
              ★ {text}
            </span>
          ))}
        </div>
      </div>

      <section id="galeria" className="py-[72px]">
        <div className="mx-auto max-w-[1180px] px-4">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-label text-xs tracking-[0.14em] text-brand-green uppercase">
                <span className="mr-2.5 font-brush text-[15px] tracking-[0.2em] text-paper normal-case">
                  ギャラリー
                </span>
                Galería
              </p>
              <h2 className="font-display text-[clamp(34px,5vw,54px)] leading-none">
                Lo último de la mesa de dibujo
              </h2>
              <p className="mt-2 max-w-[46ch] text-[#aaa4d8]">
                Las vistas previas públicas son de baja resolución y llevan marca de agua. Lo
                marcado +18 solo se ve completo en Patreon.
              </p>
            </div>
            <nav
              aria-label="Tipo de contenido"
              className="flex flex-wrap gap-1.5 rounded-sm border-[3px] border-black bg-[#120c33] p-1.5 shadow-[4px_4px_0_#000]"
            >
              {TABS.map((tab) => (
                <Link
                  key={tab.kind}
                  href={tab.href}
                  aria-current={tab.kind === kind ? "page" : undefined}
                  className={cn(
                    "rounded-xs px-4 py-2 text-center text-sm font-bold text-[#aaa4d8]",
                    tab.kind === kind && "bg-paper text-[#07041a]",
                  )}
                >
                  <span
                    aria-hidden
                    className="block font-brush text-[13px] tracking-[0.3em] opacity-80"
                  >
                    {tab.kanji}
                  </span>
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>
          <ArtworkGrid artworks={artworks} />
        </div>
      </section>
    </>
  );
}
