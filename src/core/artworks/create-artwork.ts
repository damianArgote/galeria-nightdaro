import type { z } from "zod";
import type { Artwork } from "./artwork";
import type { ArtworkRepository } from "./artwork-repository";
import { artworkFieldsSchema } from "./artwork-schemas";
import { assertRatingAllowed } from "./rating";
import { uniqueSlug } from "./unique-slug";

export const createArtworkSchema = artworkFieldsSchema;
export type CreateArtworkInput = z.input<typeof createArtworkSchema>;

/** Creates a draft at the end of its tab, with a unique slug from the title. */
export class CreateArtwork {
  constructor(
    private readonly artworks: ArtworkRepository,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(input: CreateArtworkInput): Promise<Artwork> {
    const fields = createArtworkSchema.parse(input);
    assertRatingAllowed(fields.kind, fields.rating);
    const sameKind = await this.artworks.list({ kind: fields.kind });

    const artwork: Artwork = {
      ...fields,
      id: this.newId(),
      slug: await uniqueSlug(this.artworks, fields.title),
      status: "draft",
      position: sameKind.reduce((max, a) => Math.max(max, a.position + 1), 0),
      publishedAt: null,
    };
    await this.artworks.save(artwork);
    return artwork;
  }
}
