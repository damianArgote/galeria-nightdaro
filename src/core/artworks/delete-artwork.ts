import type { z } from "zod";
import { NotFoundError } from "../shared/errors";
import type { ArtworkRepository } from "./artwork-repository";
import { artworkIdSchema } from "./artwork-schemas";

export const deleteArtworkSchema = artworkIdSchema;
export type DeleteArtworkInput = z.input<typeof deleteArtworkSchema>;

export class DeleteArtwork {
  constructor(private readonly artworks: ArtworkRepository) {}

  async execute(input: DeleteArtworkInput): Promise<void> {
    const { id } = deleteArtworkSchema.parse(input);
    if (!(await this.artworks.findById(id))) throw new NotFoundError("Artwork", id);
    await this.artworks.delete(id);
  }
}
