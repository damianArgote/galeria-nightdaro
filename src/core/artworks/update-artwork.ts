import { z } from "zod";
import { NotFoundError } from "../shared/errors";
import type { Artwork } from "./artwork";
import type { ArtworkRepository } from "./artwork-repository";
import { artworkFieldsSchema } from "./artwork-schemas";
import { uniqueSlug } from "./unique-slug";

export const updateArtworkSchema = artworkFieldsSchema.extend({ id: z.uuid() });
export type UpdateArtworkInput = z.input<typeof updateArtworkSchema>;

/**
 * Edits the fields of an artwork. The slug follows the title while the artwork is a draft, and
 * stays fixed once published so shared links keep working. Moving it to another tab sends it to
 * the end of that tab.
 */
export class UpdateArtwork {
  constructor(private readonly artworks: ArtworkRepository) {}

  async execute(input: UpdateArtworkInput): Promise<Artwork> {
    const { id, ...fields } = updateArtworkSchema.parse(input);
    const current = await this.artworks.findById(id);
    if (!current) throw new NotFoundError("Artwork", id);

    const slug =
      current.status === "draft" && fields.title !== current.title
        ? await uniqueSlug(this.artworks, fields.title, id)
        : current.slug;

    let position = current.position;
    if (fields.kind !== current.kind) {
      const target = await this.artworks.list({ kind: fields.kind });
      position = target.reduce((max, a) => Math.max(max, a.position + 1), 0);
    }

    const updated: Artwork = { ...current, ...fields, slug, position };
    await this.artworks.save(updated);
    return updated;
  }
}
