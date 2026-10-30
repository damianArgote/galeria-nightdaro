import type { MediaAssetRepository, VideoPort } from "./ports";

/**
 * Asks the video service for the real status of processing videos and stores it. Used by the
 * panel (light polling) and by the webhook, which never trusts the status in its payload.
 */
export class SyncVideoStatus {
  constructor(
    private readonly media: MediaAssetRepository,
    private readonly video: VideoPort,
  ) {}

  async forArtworks(artworkIds: string[]): Promise<void> {
    const assets = await this.media.listByArtworkIds(artworkIds);
    for (const asset of assets) {
      if (asset.type !== "video" || asset.status !== "processing" || !asset.streamVideoId) continue;
      const status = await this.video.getStatus(asset.streamVideoId);
      if (status !== "processing") await this.media.save({ ...asset, status });
    }
  }

  async forVideo(videoId: string): Promise<void> {
    const asset = await this.media.findByStreamVideoId(videoId);
    if (asset) await this.forArtworks([asset.artworkId]);
  }
}
