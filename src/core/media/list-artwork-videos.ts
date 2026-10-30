import type { Clock } from "../shared/clock";
import { systemClock } from "../shared/clock";
import { SIGNED_URL_TTL_MS } from "./list-artwork-images";
import type { MediaAssetRepository, VideoPort } from "./ports";

export interface PublicVideo {
  artworkId: string;
  status: "processing" | "ready" | "failed";
  /** Signed for 1 hour; only when the video is ready. */
  playerUrl: string | null;
}

export class ListArtworkVideos {
  constructor(
    private readonly media: MediaAssetRepository,
    private readonly video: VideoPort | null,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(artworkIds: string[]): Promise<Map<string, PublicVideo>> {
    const expiresAt = new Date(this.clock().getTime() + SIGNED_URL_TTL_MS);
    const videos = new Map<string, PublicVideo>();
    for (const asset of await this.media.listByArtworkIds(artworkIds)) {
      if (asset.type !== "video" || !asset.streamVideoId) continue;
      const status: PublicVideo["status"] =
        asset.status === "ready" || asset.status === "failed" ? asset.status : "processing";
      videos.set(asset.artworkId, {
        artworkId: asset.artworkId,
        status,
        playerUrl:
          status === "ready" && this.video
            ? this.video.playerUrl(asset.streamVideoId, expiresAt)
            : null,
      });
    }
    return videos;
  }
}
