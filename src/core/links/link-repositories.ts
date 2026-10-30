import type { Tier } from "./tier";
import type { TrackingLink } from "./tracking-link";

export interface TierRepository {
  /** Ordered by position ascending. */
  list(): Promise<Tier[]>;
  findById(id: string): Promise<Tier | null>;
  /** Inserts or replaces by id. */
  save(tier: Tier): Promise<void>;
  /** Tracking links pointing at the tier keep working, without a tier. */
  delete(id: string): Promise<void>;
}

export interface TrackingLinkRepository {
  list(): Promise<TrackingLink[]>;
  findById(id: string): Promise<TrackingLink | null>;
  findByCode(code: string): Promise<TrackingLink | null>;
  /** Inserts or replaces by id. */
  save(link: TrackingLink): Promise<void>;
  delete(id: string): Promise<void>;
}
