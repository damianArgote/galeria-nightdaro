import type { Artwork } from "../artworks/artwork";
import { isAtLeastAsStrict } from "../artworks/rating";
import type { Clock } from "../shared/clock";
import { systemClock } from "../shared/clock";
import type { MediaAsset, PublicImage } from "./media-asset";
import type { MediaAssetRepository, MediaUrlSigner } from "./ports";

export const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

type RatedArtwork = Pick<Artwork, "id" | "rating">;

/**
 * Signed public URLs for the artworks' images. Storage keys never leave this use case, and an
 * image rendered for a milder rating than the artwork's current one is never signed (it can
 * happen when two edits cross); `findStale` lists those so they can be rendered again.
 */
export class ListArtworkImages {
  constructor(
    private readonly media: MediaAssetRepository,
    private readonly signer: MediaUrlSigner,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(artworks: RatedArtwork[]): Promise<Map<string, PublicImage>> {
    const expiresAt = new Date(this.clock().getTime() + SIGNED_URL_TTL_MS);
    const images = new Map<string, PublicImage>();
    for (const { asset } of await this.readyImages(artworks)) {
      if (!this.matches(asset, artworks)) continue;
      images.set(asset.artworkId, {
        artworkId: asset.artworkId,
        thumbUrl: this.signer.sign(asset.thumbKey!, expiresAt),
        previewUrl: this.signer.sign(asset.previewKey!, expiresAt),
        blurData: asset.blurData,
        width: asset.width,
        height: asset.height,
      });
    }
    return images;
  }

  /** Artworks whose public image does not match their current rating. */
  async findStale(artworks: RatedArtwork[]): Promise<RatedArtwork[]> {
    const stale = (await this.readyImages(artworks)).filter(
      ({ asset }) => !this.matches(asset, artworks),
    );
    return stale.map(({ artwork }) => artwork);
  }

  private async readyImages(artworks: RatedArtwork[]) {
    const byId = new Map(artworks.map((a) => [a.id, a]));
    const assets = await this.media.listByArtworkIds([...byId.keys()]);
    return assets.flatMap((asset) => {
      const artwork = byId.get(asset.artworkId);
      const usable =
        asset.type === "image" && asset.status === "ready" && asset.thumbKey && asset.previewKey;
      return artwork && usable ? [{ asset, artwork }] : [];
    });
  }

  private matches(asset: MediaAsset, artworks: RatedArtwork[]): boolean {
    const artwork = artworks.find((a) => a.id === asset.artworkId)!;
    return !!asset.renderedRating && isAtLeastAsStrict(asset.renderedRating, artwork.rating);
  }
}
