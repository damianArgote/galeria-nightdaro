import type { MediaAsset } from "@/core/media/media-asset";
import type { MediaAssetRepository } from "@/core/media/ports";

export class FakeMediaAssetRepository implements MediaAssetRepository {
  readonly items = new Map<string, MediaAsset>();

  /** Stamps createdAt like the database default; override `now` to simulate age. */
  now = () => new Date();

  async save(asset: MediaAsset): Promise<void> {
    const createdAt = this.items.get(asset.id)?.createdAt ?? asset.createdAt ?? this.now();
    this.items.set(asset.id, { ...asset, createdAt });
  }

  async listByArtworkIds(artworkIds: string[]): Promise<MediaAsset[]> {
    return [...this.items.values()]
      .filter((asset) => artworkIds.includes(asset.artworkId))
      .map((asset) => ({ ...asset }));
  }

  async findByStreamVideoId(videoId: string): Promise<MediaAsset | null> {
    const asset = [...this.items.values()].find((a) => a.streamVideoId === videoId);
    return asset ? { ...asset } : null;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
