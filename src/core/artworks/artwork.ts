export const ARTWORK_KINDS = ["finished", "wip", "timelapse"] as const;
export const ARTWORK_RATINGS = ["sfw", "suggestive", "explicit"] as const;
export const ARTWORK_STATUSES = ["draft", "published", "hidden"] as const;

export type ArtworkKind = (typeof ARTWORK_KINDS)[number];
export type ArtworkRating = (typeof ARTWORK_RATINGS)[number];
export type ArtworkStatus = (typeof ARTWORK_STATUSES)[number];

export interface Artwork {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: ArtworkKind;
  rating: ArtworkRating;
  status: ArtworkStatus;
  position: number;
  tags: string[];
  publishedAt: Date | null;
}
