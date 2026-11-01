import { asc } from "drizzle-orm";
import type { PatreonEvent, PatreonMember, PatreonTier } from "@/core/patreon/patreon";
import { PATRON_STATUSES, type PatronStatus } from "@/core/patreon/patreon";
import type {
  PatreonEventRepository,
  PatreonMemberRepository,
  PatreonTierCatalog,
} from "@/core/patreon/ports";
import type { Db } from "@/db/client";
import { patreonEvents, patreonMembers, patreonTiers } from "@/db/schema";

export class DrizzlePatreonTierCatalog implements PatreonTierCatalog {
  constructor(private readonly db: Db) {}

  async list(): Promise<PatreonTier[]> {
    const rows = await this.db.select().from(patreonTiers).orderBy(asc(patreonTiers.position));
    return rows.map(({ id, title, amountCents, url }) => ({ id, title, amountCents, url }));
  }

  async replace(tiers: PatreonTier[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(patreonTiers);
      if (tiers.length > 0) {
        await tx
          .insert(patreonTiers)
          .values(tiers.map((tier, position) => ({ ...tier, position })));
      }
    });
  }
}

const toStatus = (status: string | null): PatronStatus | null =>
  PATRON_STATUSES.includes(status as PatronStatus) ? (status as PatronStatus) : null;

const memberRow = (member: PatreonMember) => ({
  id: member.id,
  status: member.status,
  amountCents: member.amountCents,
  tierIds: member.tierIds,
  pledgeStart: member.pledgeStart,
  updatedAt: new Date(),
});

export class DrizzlePatreonMemberRepository implements PatreonMemberRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<PatreonMember[]> {
    const rows = await this.db.select().from(patreonMembers).orderBy(asc(patreonMembers.id));
    return rows.map((row) => ({
      id: row.id,
      status: toStatus(row.status),
      amountCents: row.amountCents,
      tierIds: row.tierIds,
      pledgeStart: row.pledgeStart,
    }));
  }

  async save(member: PatreonMember): Promise<void> {
    const row = memberRow(member);
    await this.db
      .insert(patreonMembers)
      .values(row)
      .onConflictDoUpdate({ target: patreonMembers.id, set: row });
  }

  async replaceAll(members: PatreonMember[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(patreonMembers);
      // Chunked: a big campaign must not hit Postgres' parameter limit.
      for (let i = 0; i < members.length; i += 500) {
        await tx.insert(patreonMembers).values(members.slice(i, i + 500).map(memberRow));
      }
    });
  }
}

export class DrizzlePatreonEventRepository implements PatreonEventRepository {
  constructor(private readonly db: Db) {}

  async recordOnce(event: PatreonEvent): Promise<boolean> {
    const inserted = await this.db
      .insert(patreonEvents)
      .values(event)
      .onConflictDoNothing({ target: patreonEvents.key })
      .returning({ id: patreonEvents.id });
    return inserted.length > 0;
  }
}
