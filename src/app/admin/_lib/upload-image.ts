import type { ActionResult } from "./action-result";

/** Sends the image (and the censored version of explicit art) of an existing artwork. */
export async function uploadImage(
  artworkId: string,
  files: { image: File; censored?: File },
): Promise<ActionResult> {
  const body = new FormData();
  body.set("image", files.image);
  if (files.censored) body.set("censored", files.censored);
  body.set("charactersAreAdults", "true");
  try {
    const response = await fetch(`/api/admin/artworks/${artworkId}/image`, {
      method: "POST",
      body,
    });
    return (await response.json()) as ActionResult;
  } catch {
    return { ok: false, error: "No se pudo subir la imagen. Probá de nuevo." };
  }
}
