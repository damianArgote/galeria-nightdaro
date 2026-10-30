import type { Artwork, ArtworkKind, ArtworkStatus } from "./artwork";

export interface ArtworkFilter {
  kind?: ArtworkKind;
  status?: ArtworkStatus;
}

export interface ArtworkPosition {
  id: string;
  position: number;
}

export interface ArtworkRepository {
  /** Inserts the artwork, or replaces it when one with the same id exists. */
  save(artwork: Artwork): Promise<void>;
  findById(id: string): Promise<Artwork | null>;
  findBySlug(slug: string): Promise<Artwork | null>;
  /** Matching artworks ordered by position ascending. */
  list(filter?: ArtworkFilter): Promise<Artwork[]>;
  /** Sets every position in one atomic operation. */
  updatePositions(positions: ArtworkPosition[]): Promise<void>;
  delete(id: string): Promise<void>;
}
