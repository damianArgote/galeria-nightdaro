import type { TierRepository, TrackingLinkRepository } from "../links/link-repositories";
import type { Tier } from "../links/tier";

export interface PublicTier extends Omit<Tier, "url"> {
  /** /r/{code}: the gallery never links to a platform directly. Null until a link exists. */
  linkCode: string | null;
}

export class ListPublicTiers {
  constructor(
    private readonly tiers: TierRepository,
    private readonly links: TrackingLinkRepository,
  ) {}

  async execute(): Promise<PublicTier[]> {
    const [tiers, links] = await Promise.all([this.tiers.list(), this.links.list()]);
    return tiers.map(({ url: _url, ...tier }) => ({
      ...tier,
      linkCode: links.find((l) => l.tierId === tier.id)?.code ?? null,
    }));
  }
}
