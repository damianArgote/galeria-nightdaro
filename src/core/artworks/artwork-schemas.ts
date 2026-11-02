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
  /** Left out keeps the current link; "" removes it. */
  patreonPostUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || isPatreonUrl(value), {
      error: "Pegá el link del post en patreon.com",
    })
    .transform((value) => value || null)
    .nullable()
    .optional(),
});

/** An https page on patreon.com: the only place this button may send visitors. */
export function isPatreonUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "patreon.com" || url.hostname === "www.patreon.com")
    );
  } catch {
    return false;
  }
}

export const artworkIdSchema = z.object({ id: z.uuid() });
