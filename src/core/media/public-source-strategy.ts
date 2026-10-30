import type { ArtworkRating } from "../artworks/artwork";

/** Which image the public variants are rendered from. */
export type PublicSource =
  | { from: "original"; blur: false }
  | { from: "censored"; blur: false }
  | { from: "original"; blur: true };

export interface PublicSourceStrategy {
  choose(input: { hasCensored: boolean }): PublicSource;
}

const showOriginal: PublicSourceStrategy = {
  choose: () => ({ from: "original", blur: false }),
};

/** Explicit art is never public as is: Daro's censored version, or a strong blur. */
const censorExplicit: PublicSourceStrategy = {
  choose: ({ hasCensored }) =>
    hasCensored ? { from: "censored", blur: false } : { from: "original", blur: true },
};

const STRATEGIES: Record<ArtworkRating, PublicSourceStrategy> = {
  sfw: showOriginal,
  suggestive: showOriginal,
  explicit: censorExplicit,
};

export function publicSourceStrategyFor(rating: ArtworkRating): PublicSourceStrategy {
  return STRATEGIES[rating];
}
