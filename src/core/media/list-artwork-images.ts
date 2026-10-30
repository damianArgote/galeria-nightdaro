import type { Clock } from "../shared/clock";
import { systemClock } from "../shared/clock";
import type { PublicImage } from "./media-asset";
import type { MediaAssetRepository, MediaUrlSigner } from "./ports";

export const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

/** Signed public URLs for the artworks' images. Storage keys never leave this use case. */
export class ListArtworkImages {
  constructor(
    private readonly media: MediaAssetRepository,
    private readonly signer: MediaUrlSigner,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(artworkIds: string[]): Promise<Map<string, PublicImage>> {
    const expiresAt = new Date(this.clock().getTime() + SIGNED_URL_TTL_MS);
    const assets = await this.media.listByArtworkIds(artworkIds);
    const images = new Map<string, PublicImage>();
    for (const asset of assets) {
      if (asset.type !== "image" || asset.status !== "ready") continue;
      if (!asset.thumbKey || !asset.previewKey) continue;
      images.set(asset.artworkId, {
        artworkId: asset.artworkId,
        thumbUrl: this.signer.sign(asset.thumbKey, expiresAt),
        previewUrl: this.signer.sign(asset.previewKey, expiresAt),
        blurData: asset.blurData,
        width: asset.width,
        height: asset.height,
      });
    }
    return images;
  }
}
