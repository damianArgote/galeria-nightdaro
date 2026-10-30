import type { z } from "zod";
import { assetFiles, deleteFiles } from "../media/asset-files";
import type { MediaAssetRepository, StoragePort, VideoPort } from "../media/ports";
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
    private readonly files?: {
      media: MediaAssetRepository;
      storage: StoragePort;
      video?: VideoPort | null;
    },
  ) {}

  async execute(input: DeleteArtworkInput): Promise<void> {
    const { id } = deleteArtworkSchema.parse(input);
    if (!(await this.artworks.findById(id))) throw new NotFoundError("Artwork", id);

    const assets = (await this.files?.media.listByArtworkIds([id])) ?? [];
    await this.artworks.delete(id);
    if (!this.files) return;

    const { media, storage, video } = this.files;
    for (const asset of assets) {
      // The row is usually gone already (cascade); its files must go even if this fails.
      await media.delete(asset.id).catch(() => {});
      await deleteFiles(storage, assetFiles(asset));
      if (asset.streamVideoId) await video?.deleteVideo(asset.streamVideoId).catch(() => {});
    }
  }
}
