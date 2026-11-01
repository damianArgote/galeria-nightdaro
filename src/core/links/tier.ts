export const TIER_PLATFORMS = ["patreon", "onlyfans", "fansly"] as const;
export type TierPlatform = (typeof TIER_PLATFORMS)[number];

export interface Tier {
  id: string;
  platform: TierPlatform;
  name: string;
  priceCents: number;
  currency: string;
  url: string;
  position: number;
  /** Shown on /apoyar in this order. */
  benefits: string[];
  /** At most one tier is highlighted ("El más elegido"). */
  highlighted: boolean;
  /** The Patreon tier this one sells, once Patreon is connected; null otherwise. */
  patreonTierId: string | null;
}
