import type { z } from "zod";
import { assertLinkRefs, randomCode } from "./link-code";
import type { TierRepository, TrackingLinkRepository } from "./link-repositories";
import { trackingLinkFieldsSchema } from "./link-schemas";
import type { TrackingLink } from "./tracking-link";

export const createTrackingLinkSchema = trackingLinkFieldsSchema;
export type CreateTrackingLinkInput = z.input<typeof createTrackingLinkSchema>;

/** Creates a /r/{code} link. Without a code, a random 6-character one is generated. */
export class CreateTrackingLink {
  constructor(
    private readonly links: TrackingLinkRepository,
    private readonly tiers: TierRepository,
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly newCode: () => string = randomCode,
  ) {}

  async execute(input: CreateTrackingLinkInput): Promise<TrackingLink> {
    const { code: requested, ...fields } = createTrackingLinkSchema.parse(input);

    let code = requested;
    if (!code) {
      do code = this.newCode();
      while (await this.links.findByCode(code));
    }
    await assertLinkRefs(this.links, this.tiers, { code, tierId: fields.tierId });

    const link: TrackingLink = { ...fields, id: this.newId(), code };
    await this.links.save(link);
    return link;
  }
}
