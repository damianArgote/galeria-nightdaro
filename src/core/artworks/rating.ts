import type { ArtworkRating } from "./artwork";

const STRICTNESS: Record<ArtworkRating, number> = { sfw: 0, suggestive: 1, explicit: 2 };

/**
 * Whether variants rendered for `rendered` may be shown for an artwork rated `required`:
 * censored variants are fine for a milder rating, never the other way around.
 */
export function isAtLeastAsStrict(rendered: ArtworkRating, required: ArtworkRating): boolean {
  return STRICTNESS[rendered] >= STRICTNESS[required];
}
