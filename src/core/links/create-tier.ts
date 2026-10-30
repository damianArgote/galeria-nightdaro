import type { z } from "zod";
import { assertTierNameFree, randomCode } from "./link-code";
import type { TierRepository, TrackingLinkRepository } from "./link-repositories";
import { tierFieldsSchema } from "./link-schemas";
import type { Tier } from "./tier";

export const createTierSchema = tierFieldsSchema;
export type CreateTierInput = z.input<typeof createTierSchema>;

const PLATFORM_NAMES: Record<Tier["platform"], string> = {
  patreon: "Patreon",
  onlyfans: "OnlyFans",
  fansly: "Fansly",
};

/**
 * Adds a tier at the end of the list, with its own tracking link: the gallery only ever links
 * to /r/{code}, so every tier needs one.
 */
export class CreateTier {
  constructor(
    private readonly tiers: TierRepository,
    private readonly links?: TrackingLinkRepository,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(input: CreateTierInput): Promise<Tier> {
    const fields = createTierSchema.parse(input);
    await assertTierNameFree(this.tiers, fields);
    const existing = await this.tiers.list();
    const tier: Tier = {
      ...fields,
      id: this.newId(),
      position: existing.reduce((max, t) => Math.max(max, t.position + 1), 0),
    };
    await this.tiers.save(tier);
    if (this.links) {
      let code = randomCode();
      while (await this.links.findByCode(code)) code = randomCode();
      await this.links.save({
        id: this.newId(),
        code,
        label: `${PLATFORM_NAMES[tier.platform]} · ${tier.name}`,
        targetUrl: tier.url,
        tierId: tier.id,
      });
    }
    return tier;
  }
}
