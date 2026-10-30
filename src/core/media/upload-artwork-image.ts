import { z } from "zod";
import type { ArtworkRepository } from "../artworks/artwork-repository";
import { InvalidInputError, NotFoundError } from "../shared/errors";
import type { MediaAsset } from "./media-asset";
import {
  ACCEPTED_IMAGE_FORMATS,
  type ImageFormat,
  type ImageProcessor,
  type MediaAssetRepository,
  type StoragePort,
  type StorageZone,
} from "./ports";
import { publicSourceStrategyFor } from "./public-source-strategy";

export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

const bytes = z.custom<Uint8Array>((value) => value instanceof Uint8Array, "Falta el archivo");

export const uploadArtworkImageSchema = z.object({
  artworkId: z.uuid(),
  image: bytes,
  /** Optional censored version, used as the public image of explicit art. */
  censored: bytes.optional(),
  charactersAreAdults: z.literal(true, {
    error: "Confirmá que todos los personajes son adultos",
  }),
});
export type UploadArtworkImageInput = z.input<typeof uploadArtworkImageSchema>;

const EXTENSIONS: Record<ImageFormat, string> = { jpeg: "jpg", png: "png", webp: "webp" };
const CONTENT_TYPES: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Stores the original without metadata in the private zone and renders the public variants
 * (thumbnail, watermarked preview, placeholder) from the source the rating allows. The new image
 * replaces the artwork's previous one.
 */
export class UploadArtworkImage {
  constructor(
    private readonly deps: {
      artworks: ArtworkRepository;
      media: MediaAssetRepository;
      storage: StoragePort;
      images: ImageProcessor;
      keyPrefix: string;
      newId?: () => string;
    },
  ) {}

  async execute(
    input: UploadArtworkImageInput,
  ): Promise<Pick<MediaAsset, "id" | "width" | "height">> {
    const { artworkId, image, censored } = uploadArtworkImageSchema.parse(input);
    const { artworks, media, storage, images, keyPrefix } = this.deps;

    const artwork = await artworks.findById(artworkId);
    if (!artwork) throw new NotFoundError("Artwork", artworkId);

    const imageFormat = await this.validate(image, "image");
    const censoredFormat = censored && (await this.validate(censored, "censored"));

    const id = this.deps.newId?.() ?? crypto.randomUUID();
    const base = `${keyPrefix}/artworks/${artworkId}/${id}`;
    const written: { zone: StorageZone; key: string }[] = [];
    const put = async (zone: StorageZone, key: string, data: Uint8Array, type: string) => {
      await storage.put(zone, key, data, type);
      written.push({ zone, key });
    };

    try {
      const original = await images.sanitize(image, imageFormat);
      const originalKey = `${base}/original.${EXTENSIONS[original.format]}`;
      await put("originals", originalKey, original.data, CONTENT_TYPES[original.format]);

      const source = publicSourceStrategyFor(artwork.rating).choose({
        hasCensored: !!censored && artwork.rating === "explicit",
      });

      let censoredKey: string | null = null;
      let publicSource = original.data;
      if (source.from === "censored" && censored && censoredFormat) {
        const clean = await images.sanitize(censored, censoredFormat);
        censoredKey = `${base}/censored.${EXTENSIONS[clean.format]}`;
        await put("originals", censoredKey, clean.data, CONTENT_TYPES[clean.format]);
        publicSource = clean.data;
      }

      const variants = await images.renderPublicVariants(publicSource, { blur: source.blur });
      const thumbKey = `${base}/thumb.webp`;
      const previewKey = `${base}/preview.webp`;
      await put("public", thumbKey, variants.thumb, "image/webp");
      await put("public", previewKey, variants.preview, "image/webp");

      const asset: MediaAsset = {
        id,
        artworkId,
        type: "image",
        originalKey,
        previewKey,
        thumbKey,
        censoredKey,
        blurData: variants.placeholder,
        width: original.width,
        height: original.height,
        streamVideoId: null,
        status: "ready",
      };
      const previous = await media.listByArtworkIds([artworkId]);
      await media.save(asset);
      await Promise.all(previous.filter((p) => p.type === "image").map((p) => this.remove(p)));

      return { id, width: asset.width, height: asset.height };
    } catch (error) {
      await Promise.allSettled(written.map(({ zone, key }) => storage.delete(zone, key)));
      throw error;
    }
  }

  private async validate(data: Uint8Array, field: "image" | "censored"): Promise<ImageFormat> {
    if (data.byteLength === 0) throw new InvalidInputError("El archivo está vacío", field);
    if (data.byteLength > MAX_IMAGE_BYTES) {
      throw new InvalidInputError("El archivo supera los 30 MB", field);
    }
    const format = await this.deps.images.detectFormat(data);
    if (!format || !ACCEPTED_IMAGE_FORMATS.includes(format)) {
      throw new InvalidInputError("Solo se aceptan imágenes JPG, PNG o WebP", field);
    }
    return format;
  }

  private async remove(asset: MediaAsset) {
    const { storage, media } = this.deps;
    await media.delete(asset.id);
    const keys: [StorageZone, string | null][] = [
      ["originals", asset.originalKey],
      ["originals", asset.censoredKey],
      ["public", asset.thumbKey],
      ["public", asset.previewKey],
    ];
    await Promise.allSettled(
      keys.filter(([, key]) => key).map(([zone, key]) => storage.delete(zone, key!)),
    );
  }
}
