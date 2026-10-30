import { z } from "zod";
import { NotFoundError } from "../shared/errors";
import { assertTierNameFree } from "./link-code";
import type { TierRepository, TrackingLinkRepository } from "./link-repositories";
import { tierFieldsSchema } from "./link-schemas";
import type { Tier } from "./tier";

export const updateTierSchema = tierFieldsSchema.extend({ id: z.uuid() });
export type UpdateTierInput = z.input<typeof updateTierSchema>;

/** Edits a tier; its tracking links that pointed at the old URL follow the new one. */
export class UpdateTier {
  constructor(
    private readonly tiers: TierRepository,
    private readonly links?: TrackingLinkRepository,
  ) {}

  async execute(input: UpdateTierInput): Promise<Tier> {
    const { id, ...fields } = updateTierSchema.parse(input);
    const current = await this.tiers.findById(id);
    if (!current) throw new NotFoundError("Tier", id);
    await assertTierNameFree(this.tiers, { ...fields, ownId: id });

    const updated: Tier = { ...current, ...fields };
    await this.tiers.save(updated);
    if (this.links && updated.url !== current.url) {
      for (const link of await this.links.list()) {
        if (link.tierId === id && link.targetUrl === current.url) {
          await this.links.save({ ...link, targetUrl: updated.url });
        }
      }
    }
    return updated;
  }
}
