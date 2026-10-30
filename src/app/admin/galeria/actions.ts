"use server";

import { requireAdmin } from "@/auth";
import { deleteArtworkSchema } from "@/core/artworks/delete-artwork";
import { hideArtworkSchema } from "@/core/artworks/hide-artwork";
import { publishArtworkSchema } from "@/core/artworks/publish-artwork";
import { reorderGallerySchema } from "@/core/artworks/reorder-gallery";
import { updateArtworkSchema } from "@/core/artworks/update-artwork";
import { container } from "@/infra/container";
import { runAction } from "../_lib/run-action";

export async function updateArtworkAction(input: unknown) {
  await requireAdmin();
  return runAction(updateArtworkSchema, input, async (data) => {
    await container.updateArtwork.execute(data);
    return undefined;
  });
}

export async function publishArtworkAction(input: unknown) {
  await requireAdmin();
  return runAction(publishArtworkSchema, input, async (data) => {
    await container.publishArtwork.execute(data);
    return undefined;
  });
}

export async function hideArtworkAction(input: unknown) {
  await requireAdmin();
  return runAction(hideArtworkSchema, input, async (data) => {
    await container.hideArtwork.execute(data);
    return undefined;
  });
}

export async function deleteArtworkAction(input: unknown) {
  await requireAdmin();
  return runAction(deleteArtworkSchema, input, (data) => container.deleteArtwork.execute(data));
}

export async function reorderGalleryAction(input: unknown) {
  await requireAdmin();
  return runAction(reorderGallerySchema, input, (data) => container.reorderGallery.execute(data));
}
