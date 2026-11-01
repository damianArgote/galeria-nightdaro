import { dateRangeSchema } from "../analytics/get-analytics-summary";
import type { DateRange } from "../analytics/analytics-summary";
import type { TierRepository } from "../links/link-repositories";
import type { PatreonEventRepository, PatreonMemberRepository, PatreonTierCatalog } from "./ports";

export interface PatreonTierSummary {
  patreonTierId: string;
  title: string;
  /** Our tier linked to it (its clicks are counted under this id); null when unlinked. */
  tierId: string | null;
  active: number;
  altas: number;
}

export interface PatreonSummary {
  /** New and ended pledges in the range. */
  altas: number;
  bajas: number;
  /** Current state, not tied to the range. */
  activePatrons: number;
  monthlyIncomeCents: number;
  byTier: PatreonTierSummary[];
}

/** Patreon numbers for the Resumen, next to the clicks of the same range. */
export class GetPatreonSummary {
  constructor(
    private readonly events: PatreonEventRepository,
    private readonly members: PatreonMemberRepository,
    private readonly catalog: PatreonTierCatalog,
    private readonly tiers: TierRepository,
  ) {}

  async execute(input: DateRange): Promise<PatreonSummary> {
    const range = dateRangeSchema.parse(input);
    const [counts, members, patreonTiers, ourTiers] = await Promise.all([
      this.events.countInRange(range),
      this.members.list(),
      this.catalog.list(),
      this.tiers.list(),
    ]);
    const total = (kind: string, tier?: string) =>
      counts
        .filter((c) => c.kind === kind && (tier === undefined || c.patreonTierId === tier))
        .reduce((sum, c) => sum + c.count, 0);
    // Declined patrons (failed payment) are not counted as active nor as income.
    const active = members.filter((m) => m.status === "active_patron");

    return {
      altas: total("alta"),
      bajas: total("baja"),
      activePatrons: active.length,
      monthlyIncomeCents: active.reduce((sum, m) => sum + m.amountCents, 0),
      byTier: patreonTiers.map((tier) => ({
        patreonTierId: tier.id,
        title: tier.title,
        tierId: ourTiers.find((t) => t.patreonTierId === tier.id)?.id ?? null,
        active: active.filter((m) => m.tierIds.includes(tier.id)).length,
        altas: total("alta", tier.id),
      })),
    };
  }
}
