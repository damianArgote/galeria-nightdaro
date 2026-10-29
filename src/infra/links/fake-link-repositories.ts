import type { TierRepository, TrackingLinkRepository } from "@/core/links/link-repositories";
import type { Tier } from "@/core/links/tier";
import type { TrackingLink } from "@/core/links/tracking-link";

export class FakeTierRepository implements TierRepository {
  readonly items = new Map<string, Tier>();

  async list(): Promise<Tier[]> {
    return [...this.items.values()].sort((a, b) => a.position - b.position).map((t) => ({ ...t }));
  }

  async findById(id: string): Promise<Tier | null> {
    const tier = this.items.get(id);
    return tier ? { ...tier } : null;
  }

  async save(tier: Tier): Promise<void> {
    const sameName = [...this.items.values()].find(
      (t) => t.platform === tier.platform && t.name === tier.name && t.id !== tier.id,
    );
    if (sameName) throw new Error(`Duplicate tier: ${tier.platform}/${tier.name}`);
    this.items.set(tier.id, { ...tier });
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

export class FakeTrackingLinkRepository implements TrackingLinkRepository {
  readonly items = new Map<string, TrackingLink>();

  async list(): Promise<TrackingLink[]> {
    return [...this.items.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((l) => ({ ...l }));
  }

  async findById(id: string): Promise<TrackingLink | null> {
    const link = this.items.get(id);
    return link ? { ...link } : null;
  }

  async findByCode(code: string): Promise<TrackingLink | null> {
    const link = [...this.items.values()].find((l) => l.code === code);
    return link ? { ...link } : null;
  }

  async save(link: TrackingLink): Promise<void> {
    this.items.set(link.id, { ...link });
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
