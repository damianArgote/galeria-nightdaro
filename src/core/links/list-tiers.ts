import type { TierRepository } from "./link-repositories";
import type { Tier } from "./tier";

export class ListTiers {
  constructor(private readonly tiers: TierRepository) {}

  execute(): Promise<Tier[]> {
    return this.tiers.list();
  }
}
