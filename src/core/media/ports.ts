import type { MediaAsset } from "./media-asset";

/** `originals` has no public URL; `public` sits behind the CDN with token authentication. */
export type StorageZone = "originals" | "public";

export interface StoragePort {
  put(zone: StorageZone, key: string, data: Uint8Array, contentType: string): Promise<void>;
  /** The stored bytes, or null when the key does not exist. */
  get(zone: StorageZone, key: string): Promise<Uint8Array | null>;
  delete(zone: StorageZone, key: string): Promise<void>;
}

export const ACCEPTED_IMAGE_FORMATS = ["jpeg", "png", "webp"] as const;
export type ImageFormat = (typeof ACCEPTED_IMAGE_FORMATS)[number];

export interface SanitizedImage {
  data: Uint8Array;
  format: ImageFormat;
  width: number;
  height: number;
}

export interface PublicVariants {
  /** 400 px WebP. */
  thumb: Uint8Array;
  /** Up to 1600 px WebP q75 with the tiled watermark. */
  preview: Uint8Array;
  /** 20 px WebP as a data URI. */
  placeholder: string;
}

export interface ImageProcessor {
  /** Format from the file's magic bytes, or null when it is not an accepted image. */
  detectFormat(data: Uint8Array): Promise<ImageFormat | null>;
  /** Applies the EXIF orientation and drops every metadata block (EXIF, GPS, XMP, ICC text). */
  sanitize(data: Uint8Array, format: ImageFormat): Promise<SanitizedImage>;
  renderPublicVariants(source: Uint8Array, options: { blur: boolean }): Promise<PublicVariants>;
}

export interface MediaUrlSigner {
  /** URL for a key in the public zone, valid until `expiresAt`. */
  sign(key: string, expiresAt: Date): string;
}

export interface MediaAssetRepository {
  save(asset: MediaAsset): Promise<void>;
  listByArtworkIds(artworkIds: string[]): Promise<MediaAsset[]>;
  delete(id: string): Promise<void>;
}
