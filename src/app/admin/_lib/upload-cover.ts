import type { ActionResult } from "./action-result";

/** Sends a timelapse cover to /api/admin/artworks/{id}/cover. */
export async function uploadCover(artworkId: string, file: File): Promise<ActionResult> {
  const body = new FormData();
  body.set("cover", file);
  try {
    const response = await fetch(`/api/admin/artworks/${artworkId}/cover`, {
      method: "POST",
      body,
    });
    return (await response.json()) as ActionResult;
  } catch {
    return { ok: false, error: "No se pudo subir la portada. Probá de nuevo." };
  }
}
