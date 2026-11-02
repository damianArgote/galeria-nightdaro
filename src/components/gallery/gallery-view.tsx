import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import type { ArtworkKind } from "@/core/artworks/artwork";
import type { Audience } from "@/core/gallery/audience";
import { container } from "@/infra/container";
import { cn } from "@/lib/utils";
import { ArtworkGrid } from "./artwork-grid";
import { messages, type Locale } from "./i18n";
import { ProtectionSection } from "./protection-section";

const TABS: { kind: ArtworkKind; href: string; kanji: string }[] = [
  { kind: "finished", href: "/", kanji: "完成" },
  { kind: "wip", href: "/en-proceso", kanji: "制作中" },
  { kind: "timelapse", href: "/timelapses", kanji: "動画" },
];

/** Banner of the visual reference, served from /public until the panel can upload one. */
const BANNER = "/banner.jpg";
const hasBanner = () => existsSync(join(process.cwd(), "public", BANNER));

/** One tab of the public gallery: hero, tabs (plain links), the grid and how content is protected. */
export async function GalleryView({
  kind,
  audience,
  locale,
}: {
  kind: ArtworkKind;
  audience: Audience;
  locale: Locale;
}) {
  const t = messages[locale];
  const [settings, artworks, counts, tags] = await Promise.all([
    container.getSiteSettings.execute(),
    container.listPublicGallery.execute({ kind, audience }),
    container.countPublicGallery.execute(audience),
    container.listPublicTags.execute(audience),
  ]);
  const [first, ...rest] = settings.name.toUpperCase().split(/(?=DARO)/);
  const banner = hasBanner();

  return (
    <>
      <section className="relative overflow-hidden border-b border-[#2e2470] bg-[repeating-conic-gradient(from_0deg_at_78%_42%,#ffffff0b_0deg_1.4deg,transparent_1.4deg_5deg),radial-gradient(900px_500px_at_78%_42%,#3a1a8f_0%,transparent_60%),linear-gradient(180deg,#150b42,#07041a)]">
        <span
          aria-hidden
          className="absolute top-7 right-4 z-[2] hidden font-brush text-[clamp(26px,3.4vw,40px)] tracking-[0.35em] opacity-85 [text-shadow:3px_3px_0_#000] [writing-mode:vertical-rl] md:block"
        >
          夜の画廊
        </span>
        {banner ? (
          <div className="relative z-[1] mx-auto max-w-[1180px] px-4 pt-9 text-center">
            <h1 className="sr-only">{settings.name}</h1>
            {/* eslint-disable-next-line @next/next/no-img-element -- static banner, already sized */}
            <img
              src={BANNER}
              alt={t.hero.bannerAlt}
              width={1600}
              height={685}
              draggable={false}
              className="protected mx-auto block h-auto w-full rounded-md border-[3px] border-black shadow-[8px_8px_0_#000,0_0_60px_-10px_var(--brand-violet),0_0_90px_-30px_var(--brand-sky)]"
            />
            <span
              aria-hidden
              className="mt-3.5 block font-brush text-[clamp(18px,2.4vw,26px)] tracking-[0.5em] text-brand-green [text-shadow:0_0_14px_#39ff8899]"
            >
              夜の画廊 · ナイトダロ
            </span>
          </div>
        ) : null}
        <div
          className={cn(
            "relative z-[1] mx-auto max-w-[1180px] px-4 pb-16",
            banner ? "pt-9" : "pt-14",
          )}
        >
          {!banner && (
            <>
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
            </>
          )}
          {settings.bio && (
            <p className="mb-6 max-w-[52ch] text-lg text-[#d5d9ee]" data-testid="hero-bio">
              {settings.bio}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/apoyar" className="gallery-cta px-5 py-3">
              {t.hero.unlock}
            </Link>
            <a
              href="#galeria"
              className="rounded-full border-[1.5px] border-[#2e2470] px-5 py-3 font-bold text-paper"
            >
              {t.hero.viewGallery}
            </a>
          </div>
          {tags.length > 0 && (
            <ul
              className="mt-6 flex flex-wrap gap-2"
              aria-label={t.hero.tags}
              data-testid="hero-tags"
            >
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-[#2e2470] px-2.5 py-1 font-label text-xs text-[#aaa4d8]"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div
        aria-hidden
        className="relative z-[5] -my-1.5 -rotate-[1.2deg] overflow-hidden border-y-[3px] border-black bg-gradient-to-r from-brand-violet via-brand-sky to-brand-green text-[#12002a]"
      >
        <div className="flex w-max gap-7 py-2.5 font-display text-lg whitespace-nowrap motion-safe:animate-[marquee_26s_linear_infinite]">
          {[...t.hero.marquee, ...t.hero.marquee, ...t.hero.marquee, ...t.hero.marquee].map(
            (text, i) => (
              <span
                key={i}
                className={/[一-龯ぁ-んァ-ン]/.test(text) ? "font-brush text-xl" : undefined}
              >
                ★ {text}
              </span>
            ),
          )}
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
                {t.gallery.eyebrow}
              </p>
              <h2 className="font-display text-[clamp(34px,5vw,54px)] leading-none">
                {t.gallery.title}
              </h2>
              <p className="mt-2 max-w-[46ch] text-[#aaa4d8]">{t.gallery.intro}</p>
            </div>
            <nav
              aria-label={t.gallery.tabsLabel}
              className="flex flex-wrap gap-1.5 rounded-sm border-[3px] border-black bg-[#120c33] p-1.5 shadow-[4px_4px_0_#000]"
            >
              {TABS.map((tab) => (
                <Link
                  key={tab.kind}
                  href={tab.href}
                  // Each tab is its own page; keep the visitor at the grid instead of the hero.
                  scroll={false}
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
                  {t.gallery.tabs[tab.kind]}
                  <span
                    className="ml-1.5 font-label text-[11px] opacity-70"
                    data-testid={`count-${tab.kind}`}
                  >
                    {counts[tab.kind]}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
          <ArtworkGrid artworks={artworks} locale={locale} />
        </div>
      </section>
      <ProtectionSection locale={locale} />
    </>
  );
}
