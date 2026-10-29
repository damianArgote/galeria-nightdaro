import type { z } from "zod";
import { NotFoundError } from "../shared/errors";
import type { Artwork } from "./artwork";
import type { ArtworkRepository } from "./artwork-repository";
import { artworkIdSchema } from "./artwork-schemas";

export const hideArtworkSchema = artworkIdSchema;
export type HideArtworkInput = z.input<typeof hideArtworkSchema>;

/** Removes an artwork from the public gallery without deleting it. */
export class HideArtwork {
  constructor(private readonly artworks: ArtworkRepository) {}

  async execute(input: HideArtworkInput): Promise<Artwork> {
    const { id } = hideArtworkSchema.parse(input);
    const current = await this.artworks.findById(id);
    if (!current) throw new NotFoundError("Artwork", id);

    const hidden: Artwork = { ...current, status: "hidden" };
    await this.artworks.save(hidden);
    return hidden;
  }
}
