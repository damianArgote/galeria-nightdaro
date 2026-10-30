import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import sharp, { type Sharp } from "sharp";
import {
  ACCEPTED_IMAGE_FORMATS,
  type ImageFormat,
  type ImageProcessor,
  type PublicVariants,
  type SanitizedImage,
} from "@/core/media/ports";

const MIME_FORMATS: Record<string, ImageFormat> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

const THUMB_SIZE = 400;
const PREVIEW_SIZE = 1600;
const PLACEHOLDER_SIZE = 20;
/** Guards against decompression bombs: ~ 16k × 16k. */
const MAX_INPUT_PIXELS = 268_402_689;

// Pre-rendered tile (logo + @nightdaro at 25%); see scripts/build-watermark.mjs.
const WATERMARK_TILE = join(process.cwd(), "src/infra/media/assets/watermark-tile.png");

export class SharpImageProcessor implements ImageProcessor {
  private watermark: Promise<Buffer> | undefined;

  async detectFormat(data: Uint8Array): Promise<ImageFormat | null> {
    const type = await fileTypeFromBuffer(data);
    const format = type && MIME_FORMATS[type.mime];
    return format && ACCEPTED_IMAGE_FORMATS.includes(format) ? format : null;
  }

  async sanitize(data: Uint8Array, format: ImageFormat): Promise<SanitizedImage> {
    // sharp drops all metadata unless asked to keep it; rotate() bakes in the EXIF orientation.
    const pipeline = this.load(data).rotate();
    const encoded =
      format === "jpeg"
        ? pipeline.jpeg({ quality: 95, mozjpeg: true })
        : format === "png"
          ? pipeline.png({ compressionLevel: 9 })
          : pipeline.webp({ quality: 95 });
    const { data: out, info } = await encoded.toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(out), format, width: info.width, height: info.height };
  }

  async renderPublicVariants(
    source: Uint8Array,
    { blur }: { blur: boolean },
  ): Promise<PublicVariants> {
    // Every public variant comes from this (possibly blurred) base, never from a larger original.
    let base: Buffer = await this.load(source)
      .resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    if (blur) base = await this.strongBlur(base);
    const { width = PREVIEW_SIZE, height = PREVIEW_SIZE } = await sharp(base).metadata();

    const [thumb, preview, placeholder] = await Promise.all([
      sharp(base)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer(),
      sharp(base)
        .composite([{ input: await this.watermarkTile(width, height), tile: true, blend: "over" }])
        .webp({ quality: 75 })
        .toBuffer(),
      sharp(base)
        .resize(PLACEHOLDER_SIZE, PLACEHOLDER_SIZE, { fit: "inside" })
        .webp({ quality: 50 })
        .toBuffer(),
    ]);

    return {
      thumb: new Uint8Array(thumb),
      preview: new Uint8Array(preview),
      placeholder: `data:image/webp;base64,${placeholder.toString("base64")}`,
    };
  }

  private load(data: Uint8Array): Sharp {
    return sharp(data, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
  }

  /** Shrinks to a few dozen pixels, blurs and scales back: no detail survives. */
  private async strongBlur(image: Buffer): Promise<Buffer> {
    const { width = PREVIEW_SIZE, height = PREVIEW_SIZE } = await sharp(image).metadata();
    const tiny = await sharp(image).resize(16, 16, { fit: "inside" }).blur(1.5).toBuffer();
    return sharp(tiny)
      .resize(width, height, { fit: "fill", kernel: "cubic" })
      .blur(Math.max(width, height) / 40)
      .toBuffer();
  }

  /** sharp refuses an overlay larger than the base, so small images get a cropped tile. */
  private async watermarkTile(width: number, height: number): Promise<Buffer> {
    this.watermark ??= readFile(WATERMARK_TILE);
    const tile = await this.watermark;
    const { width: tileWidth = 0, height: tileHeight = 0 } = await sharp(tile).metadata();
    if (width >= tileWidth && height >= tileHeight) return tile;
    return sharp(tile)
      .extract({
        left: 0,
        top: 0,
        width: Math.min(width, tileWidth),
        height: Math.min(height, tileHeight),
      })
      .toBuffer();
  }
}
