import type { Artwork, ArtworkKind, ArtworkRating } from "../artworks/artwork";
import type { ArtworkRepository } from "../artworks/artwork-repository";
import type { ListArtworkImages } from "../media/list-artwork-images";
import type { ListArtworkVideos } from "../media/list-artwork-videos";
import { allowedRatings, type Audience } from "./audience";

export type MediaVariant = "thumb" | "preview" | "player";

/** What a public page may render: no storage keys and no signed URLs (cached HTML outlives them). */
export interface PublicArtwork {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: ArtworkKind;
  rating: ArtworkRating;
  tags: string[];
  image: { blurData: string | null; width: number | null; height: number | null } | null;
  hasVideo: boolean;
}

interface Deps {
  artworks: ArtworkRepository;
  images: ListArtworkImages;
  videos: ListArtworkVideos;
}

async function toPublic(deps: Deps, artworks: Artwork[]): Promise<PublicArtwork[]> {
  const [images, videos] = await Promise.all([
    deps.images.execute(artworks),
    deps.videos.execute(artworks),
  ]);
  return artworks.map((a) => {
    const image = images.get(a.id);
    return {
      id: a.id,
      slug: a.slug,
      title: a.title,
      description: a.description,
      kind: a.kind,
      rating: a.rating,
      tags: a.tags,
      image: image ? { blurData: image.blurData, width: image.width, height: image.height } : null,
      hasVideo: !!videos.get(a.id)?.playerUrl,
    };
  });
}

/** Published artworks of one tab, in gallery order, for this audience. */
export class ListPublicGallery {
  constructor(private readonly deps: Deps) {}

  async execute({ kind, audience }: { kind: ArtworkKind; audience: Audience }) {
    const artworks = await this.deps.artworks.list({
      kind,
      status: "published",
      ratings: allowedRatings(audience),
    });
    return toPublic(this.deps, artworks);
  }
}

/** A published artwork by slug, or null when it does not exist for this audience. */
export class GetPublicArtwork {
  constructor(private readonly deps: Deps) {}

  async execute({ slug, audience }: { slug: string; audience: Audience }) {
    const [artwork] = await this.deps.artworks.list({
      slug,
      status: "published",
      ratings: allowedRatings(audience),
    });
    if (!artwork) return null;
    const [result] = await toPublic(this.deps, [artwork]);
    return result!;
  }
}

/**
 * A freshly signed URL for one variant of a published artwork, checked against the audience
 * on every request (the age gate also protects the files, not only the HTML).
 */
export class ResolvePublicMedia {
  constructor(private readonly deps: Deps) {}

  async execute({
    artworkId,
    variant,
    audience,
  }: {
    artworkId: string;
    variant: MediaVariant;
    audience: Audience;
  }): Promise<string | null> {
    const artwork = await this.deps.artworks.findById(artworkId);
    if (!artwork || artwork.status !== "published") return null;
    if (!allowedRatings(audience).includes(artwork.rating)) return null;

    if (variant === "player") {
      return (await this.deps.videos.execute([artwork])).get(artwork.id)?.playerUrl ?? null;
    }
    const image = (await this.deps.images.execute([artwork])).get(artwork.id);
    if (!image) return null;
    return variant === "thumb" ? image.thumbUrl : image.previewUrl;
  }
}
