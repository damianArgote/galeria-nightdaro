import type { Artwork } from "@/core/artworks/artwork";
import type {
  ArtworkFilter,
  ArtworkPosition,
  ArtworkRepository,
} from "@/core/artworks/artwork-repository";

/** In-memory ArtworkRepository for tests. Returns copies so callers cannot mutate stored state. */
export class FakeArtworkRepository implements ArtworkRepository {
  private readonly items = new Map<string, Artwork>();

  async save(artwork: Artwork): Promise<void> {
    const sameSlug = [...this.items.values()].find(
      (item) => item.slug === artwork.slug && item.id !== artwork.id,
    );
    if (sameSlug) throw new Error(`Duplicate artwork slug: ${artwork.slug}`);
    this.items.set(artwork.id, clone(artwork));
  }

  async findById(id: string): Promise<Artwork | null> {
    const item = this.items.get(id);
    return item ? clone(item) : null;
  }

  async findBySlug(slug: string): Promise<Artwork | null> {
    const item = [...this.items.values()].find((artwork) => artwork.slug === slug);
    return item ? clone(item) : null;
  }

  async list(filter: ArtworkFilter = {}): Promise<Artwork[]> {
    return [...this.items.values()]
      .filter((item) => !filter.kind || item.kind === filter.kind)
      .filter((item) => !filter.status || item.status === filter.status)
      .sort((a, b) => a.position - b.position)
      .map(clone);
  }

  async updatePositions(positions: ArtworkPosition[]): Promise<void> {
    for (const { id, position } of positions) {
      const item = this.items.get(id);
      if (item) item.position = position;
    }
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

function clone(artwork: Artwork): Artwork {
  return { ...artwork, tags: [...artwork.tags] };
}
