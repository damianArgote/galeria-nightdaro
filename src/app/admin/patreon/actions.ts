"use server";

import { z } from "zod";
import { requireAdmin } from "@/auth";
import { linkArtworkToPostSchema } from "@/core/patreon/post-sync";
import { container } from "@/infra/container";
import { runAction } from "../_lib/run-action";

/** At most this many drafts per click: each one may download its post's image. */
const MAX_DRAFTS = 20;
const createDraftsSchema = z.object({
  postIds: z
    .array(z.string().regex(/^[\w-]{1,64}$/))
    .min(1, "Elegí al menos un post")
    .max(MAX_DRAFTS, `Hasta ${MAX_DRAFTS} por vez`),
});

function patreonOrFail() {
  const patreon = container.patreon;
  if (!patreon) throw new Error("Patreon is not configured");
  return patreon;
}

export async function linkPostAction(input: unknown) {
  await requireAdmin();
  return runAction(linkArtworkToPostSchema, input, (data) =>
    patreonOrFail().linkPost.execute(data),
  );
}

export async function createDraftsAction(input: unknown) {
  await requireAdmin();
  return runAction(createDraftsSchema, input, async ({ postIds }) => {
    const patreon = patreonOrFail();
    for (const postId of postIds) await patreon.draftFromPost.execute({ postId });
    return { created: postIds.length };
  });
}
