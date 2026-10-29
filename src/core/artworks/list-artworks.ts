import type { Artwork } from "./artwork";
import type { ArtworkFilter, ArtworkRepository } from "./artwork-repository";

export class ListArtworks {
  constructor(private readonly artworks: ArtworkRepository) {}

  execute(filter: ArtworkFilter = {}): Promise<Artwork[]> {
    return this.artworks.list(filter);
  }
}
