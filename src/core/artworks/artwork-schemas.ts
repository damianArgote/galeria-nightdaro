import { z } from "zod";
import { ARTWORK_KINDS, ARTWORK_RATINGS } from "./artwork";

/** Fields an admin edits on an artwork; shared by CreateArtwork and UpdateArtwork. */
export const artworkFieldsSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null)
    .nullable()
    .default(null),
  kind: z.enum(ARTWORK_KINDS),
  rating: z.enum(ARTWORK_RATINGS, { error: "Elegí un rating" }),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .default([])
    .transform((tags) => [...new Set(tags)]),
});

export const artworkIdSchema = z.object({ id: z.uuid() });
