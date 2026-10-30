"use server";

import { requireAdmin } from "@/auth";
import { createArtworkSchema } from "@/core/artworks/create-artwork";
import { container } from "@/infra/container";
import { runAction } from "../_lib/run-action";

export async function createArtworkAction(input: unknown) {
  await requireAdmin();
  return runAction(createArtworkSchema, input, async (data) => {
    const artwork = await container.createArtwork.execute(data);
    return { id: artwork.id, kind: artwork.kind };
  });
}
