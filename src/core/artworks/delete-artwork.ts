import type { z } from "zod";
import { assetFiles, deleteFiles } from "../media/asset-files";
import type { MediaAssetRepository, StoragePort } from "../media/ports";
import { NotFoundError } from "../shared/errors";
import type { ArtworkRepository } from "./artwork-repository";
import { artworkIdSchema } from "./artwork-schemas";

export const deleteArtworkSchema = artworkIdSchema;
export type DeleteArtworkInput = z.input<typeof deleteArtworkSchema>;

/**
 * Deletes the artwork, then its media rows and files. Files go last and best effort: a failure
 * leaves orphan files, never a row pointing at missing ones.
 */
export class DeleteArtwork {
  constructor(
    private readonly artworks: ArtworkRepository,
    private readonly files?: { media: MediaAssetRepository; storage: StoragePort },
  ) {}

  async execute(input: DeleteArtworkInput): Promise<void> {
    const { id } = deleteArtworkSchema.parse(input);
    if (!(await this.artworks.findById(id))) throw new NotFoundError("Artwork", id);

    const assets = (await this.files?.media.listByArtworkIds([id])) ?? [];
    await this.artworks.delete(id);
    if (!this.files) return;

    const { media, storage } = this.files;
    for (const asset of assets) {
      await media.delete(asset.id);
      await deleteFiles(storage, assetFiles(asset));
    }
  }
}
