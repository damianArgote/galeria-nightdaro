import type { z } from "zod";
import { NotFoundError } from "../shared/errors";
import type { TierRepository } from "./link-repositories";
import { linkIdSchema } from "./link-schemas";

export const deleteTierSchema = linkIdSchema;
export type DeleteTierInput = z.input<typeof deleteTierSchema>;

export class DeleteTier {
  constructor(private readonly tiers: TierRepository) {}

  async execute(input: DeleteTierInput): Promise<void> {
    const { id } = deleteTierSchema.parse(input);
    if (!(await this.tiers.findById(id))) throw new NotFoundError("Tier", id);
    await this.tiers.delete(id);
  }
}
