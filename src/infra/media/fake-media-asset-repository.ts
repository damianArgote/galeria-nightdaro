import type { MediaAsset } from "@/core/media/media-asset";
import type { MediaAssetRepository } from "@/core/media/ports";

export class FakeMediaAssetRepository implements MediaAssetRepository {
  readonly items = new Map<string, MediaAsset>();

  async save(asset: MediaAsset): Promise<void> {
    this.items.set(asset.id, { ...asset });
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
