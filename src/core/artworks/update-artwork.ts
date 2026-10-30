import { z } from "zod";
import { NotFoundError } from "../shared/errors";
import type { Artwork, ArtworkRating } from "./artwork";
import type { ArtworkRepository } from "./artwork-repository";
import { artworkFieldsSchema } from "./artwork-schemas";
import { assertRatingAllowed } from "./rating";
import { uniqueSlug } from "./unique-slug";

/** Renders the public image again for a rating (RerenderArtworkImage). */
export interface PublicImageRenderer {
  execute(artworkId: string, rating: ArtworkRating): Promise<void>;
}

export const updateArtworkSchema = artworkFieldsSchema.extend({ id: z.uuid() });
export type UpdateArtworkInput = z.input<typeof updateArtworkSchema>;

/**
 * Edits the fields of an artwork. The slug follows the title while the artwork is a draft, and
 * stays fixed once published so shared links keep working. Moving it to another tab sends it to
 * the end of that tab. A new rating re-renders the public image first, so an artwork is never saved
 * as explicit while its public variants still show the uncensored image.
 */
export class UpdateArtwork {
  constructor(
    private readonly artworks: ArtworkRepository,
    private readonly publicImage?: PublicImageRenderer,
  ) {}

  async execute(input: UpdateArtworkInput): Promise<Artwork> {
    const { id, ...fields } = updateArtworkSchema.parse(input);
    const current = await this.artworks.findById(id);
    if (!current) throw new NotFoundError("Artwork", id);
    assertRatingAllowed(fields.kind, fields.rating);

    const slug =
      current.status === "draft" && fields.title !== current.title
        ? await uniqueSlug(this.artworks, fields.title, id)
        : current.slug;

    let position = current.position;
    if (fields.kind !== current.kind) {
      const target = await this.artworks.list({ kind: fields.kind });
      position = target.reduce((max, a) => Math.max(max, a.position + 1), 0);
    }

    const ratingChanged = fields.rating !== current.rating;
    if (ratingChanged) await this.publicImage?.execute(id, fields.rating);

    const updated: Artwork = { ...current, ...fields, slug, position };
    try {
      await this.artworks.save(updated);
    } catch (error) {
      // The variants already follow the new rating; put them back in line with the saved one.
      if (ratingChanged) await this.publicImage?.execute(id, current.rating).catch(() => {});
      throw error;
    }
    return updated;
  }
}
