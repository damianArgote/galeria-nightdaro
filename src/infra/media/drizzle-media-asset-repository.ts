import { eq, inArray } from "drizzle-orm";
import type { MediaAsset } from "@/core/media/media-asset";
import type { MediaAssetRepository } from "@/core/media/ports";
import type { Db } from "@/db/client";
import { mediaAssets } from "@/db/schema";

const columns = {
  id: mediaAssets.id,
  artworkId: mediaAssets.artworkId,
  type: mediaAssets.type,
  originalKey: mediaAssets.originalKey,
  previewKey: mediaAssets.previewKey,
  thumbKey: mediaAssets.thumbKey,
  censoredKey: mediaAssets.censoredKey,
  blurData: mediaAssets.blurData,
  width: mediaAssets.width,
  height: mediaAssets.height,
  streamVideoId: mediaAssets.streamVideoId,
  status: mediaAssets.status,
};

export class DrizzleMediaAssetRepository implements MediaAssetRepository {
  constructor(private readonly db: Db) {}

  async save(asset: MediaAsset): Promise<void> {
    await this.db
      .insert(mediaAssets)
      .values(asset)
      .onConflictDoUpdate({ target: mediaAssets.id, set: asset });
  }

  async listByArtworkIds(artworkIds: string[]): Promise<MediaAsset[]> {
    if (artworkIds.length === 0) return [];
    return this.db
      .select(columns)
      .from(mediaAssets)
      .where(inArray(mediaAssets.artworkId, artworkIds));
  }

  async findByStreamVideoId(videoId: string): Promise<MediaAsset | null> {
    const [row] = await this.db
      .select(columns)
      .from(mediaAssets)
      .where(eq(mediaAssets.streamVideoId, videoId));
    return row ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  }
}
