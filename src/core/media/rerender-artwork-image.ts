import type { ArtworkRating } from "../artworks/artwork";
import { deleteFiles } from "./asset-files";
import type { MediaAsset } from "./media-asset";
import type { ImageProcessor, MediaAssetRepository, StoragePort, StorageZone } from "./ports";
import { publicSourceStrategyFor } from "./public-source-strategy";

/**
 * Renders the public variants again for a new rating, from the private original (or the censored
 * version). New variants get new keys: the CDN caches by URL, so overwriting preview.webp would
 * keep serving the old (possibly uncensored) copy.
 */
export class RerenderArtworkImage {
  constructor(
    private readonly deps: {
      media: MediaAssetRepository;
      storage: StoragePort;
      images: ImageProcessor;
      newId?: () => string;
    },
  ) {}

  async execute(artworkId: string, rating: ArtworkRating): Promise<void> {
    const { media, storage, images } = this.deps;
    const assets = await media.listByArtworkIds([artworkId]);
    const asset = assets.find((a) => a.type === "image" && a.originalKey);
    if (!asset) return;

    const source = publicSourceStrategyFor(rating).choose({ hasCensored: !!asset.censoredKey });
    const sourceKey = source.from === "censored" ? asset.censoredKey! : asset.originalKey!;
    const data = await storage.get("originals", sourceKey);
    if (!data) throw new Error(`Missing private file for artwork ${artworkId}`);

    const variants = await images.renderPublicVariants(data, { blur: source.blur });
    const version = (this.deps.newId?.() ?? crypto.randomUUID()).slice(0, 8);
    const dir = asset.originalKey!.slice(0, asset.originalKey!.lastIndexOf("/"));
    const thumbKey = `${dir}/thumb-${version}.webp`;
    const previewKey = `${dir}/preview-${version}.webp`;

    const written: { zone: StorageZone; key: string }[] = [];
    try {
      await storage.put("public", thumbKey, variants.thumb, "image/webp");
      written.push({ zone: "public", key: thumbKey });
      await storage.put("public", previewKey, variants.preview, "image/webp");
      written.push({ zone: "public", key: previewKey });

      const updated: MediaAsset = {
        ...asset,
        thumbKey,
        previewKey,
        blurData: variants.placeholder,
        renderedRating: rating,
      };
      await media.save(updated);
    } catch (error) {
      await deleteFiles(storage, written);
      throw error;
    }

    const stale = [asset.thumbKey, asset.previewKey].flatMap((key) =>
      key ? [{ zone: "public" as const, key }] : [],
    );
    await deleteFiles(storage, stale);
  }
}
