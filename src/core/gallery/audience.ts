import type { ArtworkRating } from "../artworks/artwork";

/**
 * Who is looking: `sfw` (no age_ok cookie, or a crawler) or `adult` (accepted the age gate).
 * Without the gate, suggestive and explicit artworks are not even queried.
 */
export const AUDIENCES = ["sfw", "adult"] as const;
export type Audience = (typeof AUDIENCES)[number];

export function allowedRatings(audience: Audience): ArtworkRating[] {
  return audience === "adult" ? ["sfw", "suggestive", "explicit"] : ["sfw"];
}

export function isAudience(value: string): value is Audience {
  return (AUDIENCES as readonly string[]).includes(value);
}
