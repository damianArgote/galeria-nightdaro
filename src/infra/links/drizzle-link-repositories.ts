import { asc, eq } from "drizzle-orm";
import type { TierRepository, TrackingLinkRepository } from "@/core/links/link-repositories";
import type { Tier } from "@/core/links/tier";
import type { TrackingLink } from "@/core/links/tracking-link";
import type { Db } from "@/db/client";
import { tiers, trackingLinks } from "@/db/schema";

export class DrizzleTierRepository implements TierRepository {
  constructor(private readonly db: Db) {}

  list(): Promise<Tier[]> {
    return this.db.select().from(tiers).orderBy(asc(tiers.position), asc(tiers.name));
  }

  async findById(id: string): Promise<Tier | null> {
    const [row] = await this.db.select().from(tiers).where(eq(tiers.id, id));
    return row ?? null;
  }

  async save(tier: Tier): Promise<void> {
    await this.db.insert(tiers).values(tier).onConflictDoUpdate({ target: tiers.id, set: tier });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(tiers).where(eq(tiers.id, id));
  }
}

export class DrizzleTrackingLinkRepository implements TrackingLinkRepository {
  constructor(private readonly db: Db) {}

  list(): Promise<TrackingLink[]> {
    return this.db.select().from(trackingLinks).orderBy(asc(trackingLinks.label));
  }

  async findById(id: string): Promise<TrackingLink | null> {
    const [row] = await this.db.select().from(trackingLinks).where(eq(trackingLinks.id, id));
    return row ?? null;
  }

  async findByCode(code: string): Promise<TrackingLink | null> {
    const [row] = await this.db.select().from(trackingLinks).where(eq(trackingLinks.code, code));
    return row ?? null;
  }

  async save(link: TrackingLink): Promise<void> {
    await this.db
      .insert(trackingLinks)
      .values(link)
      .onConflictDoUpdate({ target: trackingLinks.id, set: link });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(trackingLinks).where(eq(trackingLinks.id, id));
  }
}
