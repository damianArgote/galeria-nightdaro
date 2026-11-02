import type { Metadata } from "next";
import { PatreonButton } from "@/components/gallery/patreon-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtworkGrid } from "@/components/gallery/artwork-grid";
import { ViewTracker } from "@/components/gallery/view-tracker";
import { container } from "@/infra/container";
import { messages } from "@/components/gallery/i18n";
import { audienceFrom, localeFrom } from "../../../../audience-params";

export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ locale: string; audience: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const audience = await audienceFrom(params);
  const artwork = await container.getPublicArtwork.execute({ slug, audience });
  if (!artwork) return {};
  // Link previews only ever get a sfw image (crawlers are always served the sfw variant).
  const image =
    artwork.rating === "sfw" && artwork.image ? `/media/${artwork.id}/preview` : undefined;
  return {
    title: artwork.title,
    description: artwork.description ?? undefined,
    openGraph: {
      title: artwork.title,
      description: artwork.description ?? undefined,
      images: image,
    },
    twitter: { card: image ? "summary_large_image" : "summary", images: image },
  };
}

export default async function ArtworkPage({ params }: { params: Params }) {
  const { slug } = await params;
  const audience = await audienceFrom(params);
  const locale = await localeFrom(params);
  const t = messages[locale];
  const artwork = await container.getPublicArtwork.execute({ slug, audience });
  if (!artwork) notFound();

  return (
    <section className="mx-auto max-w-[1180px] px-4 py-14">
      <ViewTracker artworkId={artwork.id} />
      <Link href="/" className="font-label text-xs tracking-[0.14em] text-brand-green uppercase">
        {t.artwork.back}
      </Link>
      <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,360px)_1fr] md:items-start">
        <ArtworkGrid artworks={[artwork]} locale={locale} />
        <div>
          <h1 className="font-display text-[clamp(34px,5vw,54px)] leading-none">{artwork.title}</h1>
          <p className="mt-3 font-label text-xs tracking-[0.14em] text-brand-sky uppercase">
            {t.artwork.rating[artwork.rating]}
          </p>
          {artwork.description && (
            <p className="mt-5 text-lg text-[#d5d9ee]">{artwork.description}</p>
          )}
          {artwork.tags.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {artwork.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-[#2e2470] px-2.5 py-1 font-label text-xs text-[#aaa4d8]"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
          <PatreonButton artwork={artwork} locale={locale} className="mt-8 px-5 py-3" />
        </div>
      </div>
    </section>
  );
}
