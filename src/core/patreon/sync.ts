import type { TierRepository } from "../links/link-repositories";
import type { Tier } from "../links/tier";
import { systemClock, type Clock } from "../shared/clock";
import { PatreonNotConnectedError, type PatreonAccess } from "./connect";
import {
  PATREON_TRIGGERS,
  PLEDGE_EVENT_KINDS,
  type PatreonMember,
  type PatreonTier,
} from "./patreon";
import type {
  PatreonConnectionRepository,
  PatreonEventRepository,
  PatreonMemberRepository,
  PatreonPort,
  PatreonTierCatalog,
} from "./ports";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Links our Patreon tiers to Patreon's: a link chosen by hand stays, a link to a tier that no
 * longer exists is dropped, then unlinked tiers match by price (when only one Patreon tier has
 * it) and finally by name. A Patreon tier is never linked twice.
 */
export function linkTiers(ours: Tier[], theirs: PatreonTier[]): Tier[] {
  const exists = new Set(theirs.map((t) => t.id));
  const result = ours.map((tier) =>
    tier.patreonTierId && !exists.has(tier.patreonTierId) ? { ...tier, patreonTierId: null } : tier,
  );
  const taken = new Set(result.map((t) => t.patreonTierId).filter(Boolean));
  const free = () => theirs.filter((t) => !taken.has(t.id));
  const link = (match: (tier: Tier, candidate: PatreonTier) => boolean, unique: boolean) => {
    for (const [i, tier] of result.entries()) {
      if (tier.platform !== "patreon" || tier.patreonTierId) continue;
      const candidates = free().filter((candidate) => match(tier, candidate));
      if (candidates.length === 0 || (unique && candidates.length > 1)) continue;
      result[i] = { ...tier, patreonTierId: candidates[0]!.id };
      taken.add(candidates[0]!.id);
    }
  };
  link((tier, candidate) => candidate.amountCents === tier.priceCents, true);
  link((tier, candidate) => sameName(tier.name, candidate.title), false);
  return result;
}

/**
 * After connecting: Patreon's tiers, the links to ours, the webhook (created once) and the
 * current members. Safe to run again; reconnecting repairs whatever a failed run left out.
 */
export class SetUpPatreonCampaign {
  constructor(
    private readonly deps: {
      patreon: PatreonPort;
      access: PatreonAccess;
      connections: PatreonConnectionRepository;
      catalog: PatreonTierCatalog;
      members: PatreonMemberRepository;
      tiers: TierRepository;
      webhookUri: string;
    },
  ) {}

  async execute(): Promise<void> {
    const { patreon, access, connections, catalog, members, tiers, webhookUri } = this.deps;
    const token = await access.token();
    const connection = await connections.get();
    if (!connection) throw new PatreonNotConnectedError();

    const campaign = await patreon.getCampaign(token);
    await catalog.replace(campaign.tiers);

    const current = await tiers.list();
    const linked = linkTiers(current, campaign.tiers);
    // Unlinks first, so the unique index never sees a Patreon tier on two rows mid-way.
    const changed = linked.filter((t, i) => t.patreonTierId !== current[i]!.patreonTierId);
    for (const tier of changed.filter((t) => t.patreonTierId === null)) await tiers.save(tier);
    for (const tier of changed.filter((t) => t.patreonTierId !== null)) await tiers.save(tier);

    if (!connection.webhook) {
      // A webhook left by an earlier failed set-up would keep posting with a secret we lost.
      for (const old of await patreon.listWebhooks(token)) {
        if (old.uri === webhookUri) await patreon.deleteWebhook(token, old.id);
      }
      const webhook = await patreon.createWebhook(token, {
        campaignId: connection.campaignId,
        uri: webhookUri,
        triggers: PATREON_TRIGGERS,
      });
      const latest = (await connections.get()) ?? connection;
      await connections.save({ ...latest, webhook });
    }

    await members.replaceAll(await patreon.listMembers(token, connection.campaignId));
  }
}

/**
 * A verified pledge webhook: the member's current state and one event for the Resumen.
 * Deliveries can arrive late or out of order (retries), so the member is read back from
 * Patreon instead of trusting the payload; the payload is only the fallback when Patreon fails.
 * The member is saved before the event: if the save fails, Patreon's retry is not deduplicated.
 */
export class RecordPatreonPledge {
  constructor(
    private readonly deps: {
      patreon: PatreonPort;
      access: PatreonAccess;
      members: PatreonMemberRepository;
      events: PatreonEventRepository;
      clock?: Clock;
    },
  ) {}

  async execute(input: { trigger: string; key: string; member: PatreonMember }): Promise<void> {
    const kind = PLEDGE_EVENT_KINDS[input.trigger];
    if (!kind) throw new Error(`Not a pledge trigger: ${input.trigger}`);
    const { patreon, access, members, events, clock = systemClock } = this.deps;

    let current: PatreonMember = input.member;
    try {
      const fetched = await patreon.getMember(await access.token(), input.member.id);
      current = fetched ?? {
        ...input.member,
        status: "former_patron",
        amountCents: 0,
        tierIds: [],
      };
    } catch (error) {
      console.error("Could not read the Patreon member; using the webhook payload", error);
    }
    await members.save(current);

    await events.recordOnce({
      key: input.key,
      kind,
      memberId: input.member.id,
      amountCents: input.member.amountCents,
      patreonTierId: input.member.tierIds[0] ?? null,
      occurredAt: clock(),
    });
  }
}
