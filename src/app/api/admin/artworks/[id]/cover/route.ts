import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_IMAGE_BYTES } from "@/core/media/upload-artwork-image";
import { InvalidInputError } from "@/core/shared/errors";
import { container } from "@/infra/container";
import type { ActionResult } from "@/app/admin/_lib/action-result";
import { adminRoute } from "../../../admin-route";

const fail = (status: number, error: string) =>
  Response.json({ ok: false, error, fieldErrors: { cover: [error] } } satisfies ActionResult, {
    status,
  });

/**
 * The cover of a timelapse (multipart `cover`): same pipeline as any artwork image, and it
 * replaces the previous one, Bunny's automatic thumbnail included.
 */
export const POST = adminRoute(async (request) => {
  // /api/admin/artworks/{id}/cover
  const id = z.uuid().safeParse(new URL(request.url).pathname.split("/").at(-2));
  if (!id.success) return fail(404, "La obra no existe.");
  const length = Number(request.headers.get("content-length"));
  if (!length) return fail(411, "Falta el tamaño de la subida.");
  if (length > MAX_IMAGE_BYTES + 1024 * 1024) return fail(413, "La imagen supera los 30 MB.");

  const artwork = await container.findArtwork(id.data);
  if (!artwork) return fail(404, "La obra no existe.");
  if (artwork.kind !== "timelapse") return fail(400, "Solo los timelapses llevan portada.");

  let cover: FormDataEntryValue | null;
  try {
    cover = (await request.formData()).get("cover");
  } catch {
    return fail(400, "No se pudo leer la subida.");
  }
  if (!(cover instanceof File) || cover.size === 0) return fail(400, "Elegí una imagen.");

  try {
    await container.uploadArtworkImage.execute({
      artworkId: artwork.id,
      image: new Uint8Array(await cover.arrayBuffer()),
      // Confirmed when the timelapse was created (StartTimelapseUpload requires it).
      charactersAreAdults: true,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) return fail(400, error.message);
    throw error;
  }
  revalidatePath("/", "layout");
  return Response.json({ ok: true, data: undefined } satisfies ActionResult);
});
