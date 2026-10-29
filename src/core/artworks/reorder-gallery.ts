import { z } from "zod";
import { ConflictError } from "../shared/errors";
import { ARTWORK_KINDS } from "./artwork";
import type { ArtworkRepository } from "./artwork-repository";

export const reorderGallerySchema = z.object({
  kind: z.enum(ARTWORK_KINDS),
  ids: z.array(z.uuid()).max(1000),
});
export type ReorderGalleryInput = z.input<typeof reorderGallerySchema>;

/** Sets the order of one tab. `ids` must list every artwork of that tab exactly once. */
export class ReorderGallery {
  constructor(private readonly artworks: ArtworkRepository) {}

  async execute(input: ReorderGalleryInput): Promise<void> {
    const { kind, ids } = reorderGallerySchema.parse(input);
    const current = await this.artworks.list({ kind });

    const expected = new Set(current.map((a) => a.id));
    const received = new Set(ids);
    const sameSet =
      received.size === ids.length &&
      received.size === expected.size &&
      ids.every((id) => expected.has(id));
    if (!sameSet) {
      throw new ConflictError("The gallery changed; reload and try again.", "ids");
    }

    await this.artworks.updatePositions(ids.map((id, position) => ({ id, position })));
  }
}
