import type { Artwork } from "../artworks/artwork";
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

  /** Explicit timelapses (only possible in rows created before the rule) are never signed. */
  async execute(artworks: Pick<Artwork, "id" | "rating">[]): Promise<Map<string, PublicVideo>> {
    const expiresAt = new Date(this.clock().getTime() + SIGNED_URL_TTL_MS);
    const ratings = new Map(artworks.map((a) => [a.id, a.rating]));
    const videos = new Map<string, PublicVideo>();
    for (const asset of await this.media.listByArtworkIds([...ratings.keys()])) {
      if (asset.type !== "video" || !asset.streamVideoId) continue;
      const showable = ratings.get(asset.artworkId) !== "explicit";
      const status: PublicVideo["status"] =
        asset.status === "ready" || asset.status === "failed" ? asset.status : "processing";
      videos.set(asset.artworkId, {
        artworkId: asset.artworkId,
        status,
        playerUrl:
          status === "ready" && showable && this.video
            ? this.video.playerUrl(asset.streamVideoId, expiresAt)
            : null,
      });
    }
    return videos;
  }
}
