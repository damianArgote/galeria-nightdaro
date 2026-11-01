import type { MediaAssetRepository, VideoPort } from "./ports";
import type { UploadArtworkImage } from "./upload-artwork-image";

/**
 * A timelapse whose video is ready but has no cover gets the video service's thumbnail as its
 * image, through the same pipeline as any artwork (low resolution, watermark). A cover uploaded
 * by hand is never replaced. One failure does not stop the others; the next sync retries it.
 */
export class EnsureTimelapseCovers {
  constructor(
    private readonly media: MediaAssetRepository,
    private readonly video: VideoPort,
    private readonly upload: UploadArtworkImage,
  ) {}

  async forVideo(videoId: string): Promise<void> {
    const asset = await this.media.findByStreamVideoId(videoId);
    if (asset) await this.forArtworks([asset.artworkId]);
  }

  async forArtworks(artworkIds: string[]): Promise<void> {
    const assets = await this.media.listByArtworkIds(artworkIds);
    const withImage = new Set(assets.filter((a) => a.type === "image").map((a) => a.artworkId));
    for (const asset of assets) {
      if (asset.type !== "video" || asset.status !== "ready" || !asset.streamVideoId) continue;
      if (withImage.has(asset.artworkId)) continue;
      try {
        const thumbnail = await this.video.thumbnail(asset.streamVideoId);
        if (!thumbnail) continue;
        // Confirmed when the timelapse was created (StartTimelapseUpload requires it).
        await this.upload.execute({
          artworkId: asset.artworkId,
          image: thumbnail,
          charactersAreAdults: true,
        });
        withImage.add(asset.artworkId);
      } catch (error) {
        console.error("Could not create the timelapse cover", asset.artworkId, error);
      }
    }
  }
}
