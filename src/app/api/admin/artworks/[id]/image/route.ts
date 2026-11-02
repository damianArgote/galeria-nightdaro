import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_IMAGE_BYTES } from "@/core/media/upload-artwork-image";
import { InvalidInputError } from "@/core/shared/errors";
import { container } from "@/infra/container";
import type { ActionResult } from "@/app/admin/_lib/action-result";
import { adminRoute } from "../../../admin-route";

/** Image + optional censored version. */
const MAX_REQUEST_BYTES = 2 * MAX_IMAGE_BYTES + 1024 * 1024;

const fail = (status: number, error: string, field = "image") =>
  Response.json({ ok: false, error, fieldErrors: { [field]: [error] } } satisfies ActionResult, {
    status,
  });

/**
 * Adds or replaces the image of an existing artwork (multipart `image`, and `censored` for
 * explicit art): drafts from Patreon, a timelapse cover, a better version. Same pipeline as a new
 * upload; the previous image and its files go.
 */
export const POST = adminRoute(async (request) => {
  // /api/admin/artworks/{id}/image
  const id = z.uuid().safeParse(new URL(request.url).pathname.split("/").at(-2));
  if (!id.success) return fail(404, "La obra no existe.");
  const length = Number(request.headers.get("content-length"));
  if (!length) return fail(411, "Falta el tamaño de la subida.");
  if (length > MAX_REQUEST_BYTES) return fail(413, "Los archivos superan los 30 MB.");

  const artwork = await container.findArtwork(id.data);
  if (!artwork) return fail(404, "La obra no existe.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "No se pudo leer la subida.");
  }
  const image = form.get("image");
  const censored = form.get("censored");
  if (!(image instanceof File) || image.size === 0) return fail(400, "Elegí una imagen.");
  // Asked again here: drafts from Patreon were never confirmed in the panel.
  if (form.get("charactersAreAdults") !== "true") {
    return fail(400, "Confirmá que todos los personajes son adultos", "charactersAreAdults");
  }

  try {
    await container.uploadArtworkImage.execute({
      artworkId: artwork.id,
      image: new Uint8Array(await image.arrayBuffer()),
      censored:
        censored instanceof File && censored.size > 0
          ? new Uint8Array(await censored.arrayBuffer())
          : undefined,
      charactersAreAdults: true,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) return fail(400, error.message, error.field ?? "image");
    throw error;
  }
  revalidatePath("/", "layout");
  return Response.json({ ok: true, data: undefined } satisfies ActionResult);
});
