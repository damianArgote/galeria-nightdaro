import { and, asc, eq, type SQL } from "drizzle-orm";
import type { Artwork } from "@/core/artworks/artwork";
import type {
  ArtworkFilter,
  ArtworkPosition,
  ArtworkRepository,
} from "@/core/artworks/artwork-repository";
import type { Db } from "@/db/client";
import { artworks } from "@/db/schema";

type ArtworkRow = typeof artworks.$inferSelect;

function toArtwork(row: ArtworkRow): Artwork {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    kind: row.kind,
    rating: row.rating,
    status: row.status,
    position: row.position,
    tags: row.tags,
    publishedAt: row.publishedAt,
  };
}

export class DrizzleArtworkRepository implements ArtworkRepository {
  constructor(private readonly db: Db) {}

  async save(artwork: Artwork): Promise<void> {
    await this.db
      .insert(artworks)
      .values(artwork)
      .onConflictDoUpdate({ target: artworks.id, set: artwork });
  }

  async findById(id: string): Promise<Artwork | null> {
    const [row] = await this.db.select().from(artworks).where(eq(artworks.id, id));
    return row ? toArtwork(row) : null;
  }

  async findBySlug(slug: string): Promise<Artwork | null> {
    const [row] = await this.db.select().from(artworks).where(eq(artworks.slug, slug));
    return row ? toArtwork(row) : null;
  }

  async list(filter: ArtworkFilter = {}): Promise<Artwork[]> {
    const conditions: SQL[] = [];
    if (filter.kind) conditions.push(eq(artworks.kind, filter.kind));
    if (filter.status) conditions.push(eq(artworks.status, filter.status));
    const rows = await this.db
      .select()
      .from(artworks)
      .where(and(...conditions))
      .orderBy(asc(artworks.position), asc(artworks.createdAt));
    return rows.map(toArtwork);
  }

  async updatePositions(positions: ArtworkPosition[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const { id, position } of positions) {
        await tx.update(artworks).set({ position }).where(eq(artworks.id, id));
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(artworks).where(eq(artworks.id, id));
  }
}
