import type { z } from "zod";
import type { TierRepository } from "./link-repositories";
import { tierFieldsSchema } from "./link-schemas";
import type { Tier } from "./tier";

export const createTierSchema = tierFieldsSchema;
export type CreateTierInput = z.input<typeof createTierSchema>;

/** Adds a tier at the end of the list. */
export class CreateTier {
  constructor(
    private readonly tiers: TierRepository,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(input: CreateTierInput): Promise<Tier> {
    const fields = createTierSchema.parse(input);
    const existing = await this.tiers.list();
    const tier: Tier = {
      ...fields,
      id: this.newId(),
      position: existing.reduce((max, t) => Math.max(max, t.position + 1), 0),
    };
    await this.tiers.save(tier);
    return tier;
  }
}
