import type { z } from "zod";
import { systemClock, type Clock } from "../shared/clock";
import { NotFoundError } from "../shared/errors";
import type { Artwork } from "./artwork";
import type { ArtworkRepository } from "./artwork-repository";
import { artworkIdSchema } from "./artwork-schemas";

export const publishArtworkSchema = artworkIdSchema;
export type PublishArtworkInput = z.input<typeof publishArtworkSchema>;

/** Makes a draft or hidden artwork public. The first publication date is kept. */
export class PublishArtwork {
  constructor(
    private readonly artworks: ArtworkRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(input: PublishArtworkInput): Promise<Artwork> {
    const { id } = publishArtworkSchema.parse(input);
    const current = await this.artworks.findById(id);
    if (!current) throw new NotFoundError("Artwork", id);

    const published: Artwork = {
      ...current,
      status: "published",
      publishedAt: current.publishedAt ?? this.clock(),
    };
    await this.artworks.save(published);
    return published;
  }
}
