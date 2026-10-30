import { z } from "zod";
import type { ArtworkRepository } from "../artworks/artwork-repository";
import { artworkFieldsSchema } from "../artworks/artwork-schemas";
import { CreateArtwork } from "../artworks/create-artwork";
import type { Clock } from "../shared/clock";
import { systemClock } from "../shared/clock";
import type { MediaAsset } from "./media-asset";
import type { MediaAssetRepository, VideoPort, VideoUploadAuthorization } from "./ports";

/** Long enough for a big file on a slow connection; checked on every TUS request. */
export const VIDEO_UPLOAD_TTL_MS = 6 * 60 * 60 * 1000;

export const startTimelapseUploadSchema = artworkFieldsSchema.omit({ kind: true }).extend({
  charactersAreAdults: z.literal(true, {
    error: "Confirmá que todos los personajes son adultos",
  }),
});
export type StartTimelapseUploadInput = z.input<typeof startTimelapseUploadSchema>;

/**
 * Creates the timelapse draft and an empty video in the video service, and returns a signed,
 * single-video authorization so the browser uploads the file directly (it never goes through
 * our server). The asset stays `processing` until the service finishes encoding.
 */
export class StartTimelapseUpload {
  constructor(
    private readonly deps: {
      artworks: ArtworkRepository;
      media: MediaAssetRepository;
      video: VideoPort;
      clock?: Clock;
      newId?: () => string;
    },
  ) {}

  async execute(
    input: StartTimelapseUploadInput,
  ): Promise<{ artworkId: string; upload: VideoUploadAuthorization }> {
    const { title, description, rating, tags } = startTimelapseUploadSchema.parse(input);
    const fields = { title, description, rating, tags };
    const { artworks, media, video } = this.deps;

    const artwork = await new CreateArtwork(artworks).execute({ ...fields, kind: "timelapse" });
    let videoId: string | undefined;
    try {
      ({ videoId } = await video.createVideo(artwork.title));
      const asset: MediaAsset = {
        id: this.deps.newId?.() ?? crypto.randomUUID(),
        artworkId: artwork.id,
        type: "video",
        originalKey: null,
        previewKey: null,
        thumbKey: null,
        censoredKey: null,
        blurData: null,
        width: null,
        height: null,
        streamVideoId: videoId,
        status: "processing",
        renderedRating: null,
      };
      await media.save(asset);

      const now = (this.deps.clock ?? systemClock)();
      const upload = video.authorizeUpload(videoId, new Date(now.getTime() + VIDEO_UPLOAD_TTL_MS));
      return { artworkId: artwork.id, upload };
    } catch (error) {
      await artworks.delete(artwork.id);
      if (videoId) await video.deleteVideo(videoId).catch(() => {});
      throw error;
    }
  }
}
