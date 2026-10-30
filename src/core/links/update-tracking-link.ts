import { z } from "zod";
import { NotFoundError } from "../shared/errors";
import { assertLinkRefs } from "./link-code";
import type { TierRepository, TrackingLinkRepository } from "./link-repositories";
import { trackingLinkFieldsSchema } from "./link-schemas";
import type { TrackingLink } from "./tracking-link";

export const updateTrackingLinkSchema = trackingLinkFieldsSchema.extend({ id: z.uuid() });
export type UpdateTrackingLinkInput = z.input<typeof updateTrackingLinkSchema>;

/** Edits a link. An empty code keeps the current one. */
export class UpdateTrackingLink {
  constructor(
    private readonly links: TrackingLinkRepository,
    private readonly tiers: TierRepository,
  ) {}

  async execute(input: UpdateTrackingLinkInput): Promise<TrackingLink> {
    const { id, code: requested, ...fields } = updateTrackingLinkSchema.parse(input);
    const current = await this.links.findById(id);
    if (!current) throw new NotFoundError("TrackingLink", id);

    const code = requested ?? current.code;
    await assertLinkRefs(this.links, this.tiers, { code, tierId: fields.tierId, ownId: id });

    const updated: TrackingLink = { ...current, ...fields, code };
    await this.links.save(updated);
    return updated;
  }
}
