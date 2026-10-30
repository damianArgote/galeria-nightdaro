export const MEDIA_TYPES = ["image", "video"] as const;
export const MEDIA_STATUSES = ["processing", "ready", "failed"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

/**
 * A stored file and its variants. `originalKey` and `censoredKey` live in the private zone and
 * must never reach a page or a response; only the public keys are signed for the browser.
 */
export interface MediaAsset {
  id: string;
  artworkId: string;
  type: MediaType;
  originalKey: string | null;
  previewKey: string | null;
  thumbKey: string | null;
  censoredKey: string | null;
  blurData: string | null;
  width: number | null;
  height: number | null;
  streamVideoId: string | null;
  status: MediaStatus;
}

/** What a page may receive about an image: signed public URLs, never storage keys. */
export interface PublicImage {
  artworkId: string;
  thumbUrl: string;
  previewUrl: string;
  blurData: string | null;
  width: number | null;
  height: number | null;
}
