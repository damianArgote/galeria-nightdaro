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
}
