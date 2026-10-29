import { z } from "zod";
import { NotFoundError } from "../shared/errors";
import type { TierRepository } from "./link-repositories";
import { tierFieldsSchema } from "./link-schemas";
import type { Tier } from "./tier";

export const updateTierSchema = tierFieldsSchema.extend({ id: z.uuid() });
export type UpdateTierInput = z.input<typeof updateTierSchema>;

export class UpdateTier {
  constructor(private readonly tiers: TierRepository) {}

  async execute(input: UpdateTierInput): Promise<Tier> {
    const { id, ...fields } = updateTierSchema.parse(input);
    const current = await this.tiers.findById(id);
    if (!current) throw new NotFoundError("Tier", id);

    const updated: Tier = { ...current, ...fields };
    await this.tiers.save(updated);
    return updated;
  }
}
