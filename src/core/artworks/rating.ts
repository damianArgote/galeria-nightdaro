import { ConflictError } from "../shared/errors";
import type { ArtworkKind, ArtworkRating } from "./artwork";

const STRICTNESS: Record<ArtworkRating, number> = { sfw: 0, suggestive: 1, explicit: 2 };

/**
 * Whether variants rendered for `rendered` may be shown for an artwork rated `required`:
 * censored variants are fine for a milder rating, never the other way around.
 */
export function isAtLeastAsStrict(rendered: ArtworkRating, required: ArtworkRating): boolean {
  return STRICTNESS[rendered] >= STRICTNESS[required];
}

/**
 * Videos cannot be censored like images, and explicit art only lives on Patreon
 * (docs/arquitectura.md, "Seguridad"), so a timelapse can never be explicit.
 */
export function assertRatingAllowed(kind: ArtworkKind, rating: ArtworkRating): void {
  if (kind === "timelapse" && rating === "explicit") {
    throw new ConflictError(
      "Un timelapse no puede ser explícito: los videos no se censuran y lo explícito va solo a Patreon.",
      "rating",
    );
  }
}
