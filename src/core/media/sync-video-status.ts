import type { Clock } from "../shared/clock";
import { systemClock } from "../shared/clock";
import type { MediaAssetRepository, VideoPort } from "./ports";
import { VIDEO_UPLOAD_TTL_MS } from "./start-timelapse-upload";

/**
 * Asks the video service for the real status of processing videos and stores it. Used by the
 * panel (light polling) and by the webhook, which never trusts the status in its payload.
 * A file that never arrived within its upload authorization (tab closed mid-upload) is failed.
 */
export class SyncVideoStatus {
  constructor(
    private readonly media: MediaAssetRepository,
    private readonly video: VideoPort,
    private readonly clock: Clock = systemClock,
  ) {}

  /** One failed lookup does not stop the others; it stays processing until the next sync. */
  async forArtworks(artworkIds: string[]): Promise<void> {
    const assets = await this.media.listByArtworkIds(artworkIds);
    for (const asset of assets) {
      if (asset.type !== "video" || asset.status !== "processing" || !asset.streamVideoId) continue;
      try {
        const status = await this.video.getStatus(asset.streamVideoId);
        if (status === "ready" || status === "failed") {
          await this.media.save({ ...asset, status });
        } else if (status === "awaiting_upload" && this.uploadWindowClosed(asset.createdAt)) {
          await this.media.save({ ...asset, status: "failed" });
        }
      } catch {
        continue;
      }
    }
  }

  async forVideo(videoId: string): Promise<void> {
    const asset = await this.media.findByStreamVideoId(videoId);
    if (asset) await this.forArtworks([asset.artworkId]);
  }

  private uploadWindowClosed(createdAt: Date | undefined): boolean {
    return !!createdAt && this.clock().getTime() - createdAt.getTime() > VIDEO_UPLOAD_TTL_MS;
  }
}
