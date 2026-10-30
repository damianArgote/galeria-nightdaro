import Link from "next/link";
import { requireAdmin } from "@/auth";
import { ARTWORK_KINDS, type ArtworkKind } from "@/core/artworks/artwork";
import { KIND_LABELS } from "@/components/admin/artwork-labels";
import { Panel, ViewHeader } from "@/components/admin/panel";
import { Button } from "@/components/ui/button";
import { container } from "@/infra/container";
import { cn } from "@/lib/utils";
import { GalleryManager } from "./gallery-manager";

function parseKind(value: string | string[] | undefined): ArtworkKind {
  return ARTWORK_KINDS.find((kind) => kind === value) ?? "finished";
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string | string[] }>;
}) {
  await requireAdmin();
  const kind = parseKind((await searchParams).tipo);
  const artworks = await container.listArtworks.execute({ kind });
  const ids = artworks.map((a) => a.id);
  if (kind === "timelapse") {
    // Light polling: the panel refreshes while a video is processing (see GalleryManager).
    await container.syncVideoStatus?.forArtworks(ids).catch((error: unknown) => {
      console.error("Could not sync video status", error);
    });
  }
  // Images rendered for a milder rating than the artwork's (crossed edits, older uploads) are
  // never signed; render them again here so the panel heals them.
  for (const artwork of await container.listArtworkImages.findStale(artworks)) {
    await container.rerenderArtworkImage
      .execute(artwork.id, artwork.rating)
      .catch((error: unknown) => {
        console.error("Could not re-render a stale image", error);
      });
  }
  const [images, videoList] = await Promise.all([
    container.listArtworkImages.execute(artworks),
    container.listArtworkVideos.execute(ids),
  ]);
  const videos = Object.fromEntries(
    [...videoList.values()].map((v) => [v.artworkId, { status: v.status, playerUrl: v.playerUrl }]),
  );
  const thumbs = Object.fromEntries(
    [...images.values()].map((image) => [
      image.artworkId,
      { url: image.thumbUrl, blurData: image.blurData },
    ]),
  );

  return (
    <>
      <ViewHeader
        kanji="画廊"
        eyebrow="Orden de la página"
        title="Administrar la galería"
        description="Arrastrá para cambiar el orden en que aparecen. La primera de cada pestaña se ve primero. Ocultar no borra la obra."
      />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Filtrar por tipo"
            className="flex flex-wrap gap-1.5 rounded-sm border-2 border-black bg-card p-1 shadow-[3px_3px_0_#000]"
          >
            {ARTWORK_KINDS.map((k) => (
              <Link
                key={k}
                href={`/admin/galeria?tipo=${k}`}
                aria-current={k === kind ? "page" : undefined}
                className={cn(
                  "rounded-xs px-3 py-1.5 text-center text-sm font-bold text-muted-foreground",
                  k === kind && "bg-foreground text-background",
                )}
              >
                <span aria-hidden className="block text-xs tracking-[0.3em] opacity-80">
                  {KIND_LABELS[k].kanji}
                </span>
                {KIND_LABELS[k].label}
              </Link>
            ))}
          </nav>
          <Button nativeButton={false} render={<Link href="/admin/subir" />}>
            Nueva obra
          </Button>
        </div>
        <GalleryManager kind={kind} artworks={artworks} thumbs={thumbs} videos={videos} />
      </Panel>
    </>
  );
}
