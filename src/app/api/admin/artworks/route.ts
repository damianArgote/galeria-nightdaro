import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createArtworkSchema } from "@/core/artworks/create-artwork";
import { MAX_IMAGE_BYTES } from "@/core/media/upload-artwork-image";
import { InvalidInputError } from "@/core/shared/errors";
import { container } from "@/infra/container";
import type { ActionResult } from "@/app/admin/_lib/action-result";
import { adminRoute } from "../admin-route";

/** Image + optional censored version + form fields. */
const MAX_REQUEST_BYTES = 2 * MAX_IMAGE_BYTES + 1024 * 1024;

const fail = (status: number, error: string, fieldErrors?: Record<string, string[]>) =>
  Response.json({ ok: false, error, fieldErrors } satisfies ActionResult, { status });

/**
 * Creates a draft artwork with its image (multipart). A route handler instead of a Server
 * Action so the browser can report upload progress. Responses never include storage keys.
 */
export const POST = adminRoute(async (request) => {
  const length = Number(request.headers.get("content-length"));
  if (!length) return fail(411, "Falta el tamaño de la subida.");
  if (length > MAX_REQUEST_BYTES) return fail(413, "Los archivos superan los 30 MB.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "No se pudo leer la subida.");
  }

  const image = form.get("image");
  const censored = form.get("censored");
  if (!(image instanceof File) || image.size === 0) {
    return fail(400, "Elegí una imagen.", { image: ["Elegí una imagen"] });
  }
  if (form.get("charactersAreAdults") !== "true") {
    const message = "Confirmá que todos los personajes son adultos";
    return fail(400, message, { charactersAreAdults: [message] });
  }

  const fields = createArtworkSchema.extend({ kind: z.enum(["finished", "wip"]) }).safeParse({
    title: form.get("title"),
    description: form.get("description") ?? "",
    kind: form.get("kind"),
    rating: form.get("rating") ?? undefined,
    tags: form.getAll("tags"),
  });
  if (!fields.success) {
    return fail(400, "Revisá los campos marcados.", z.flattenError(fields.error).fieldErrors);
  }

  const artwork = await container.createArtwork.execute(fields.data);
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
    await container.deleteArtwork.execute({ id: artwork.id });
    if (error instanceof InvalidInputError) {
      return fail(400, error.message, error.field ? { [error.field]: [error.message] } : undefined);
    }
    throw error;
  }

  revalidatePath("/", "layout");
  return Response.json({ ok: true, data: { kind: artwork.kind } } satisfies ActionResult<{
    kind: string;
  }>);
});
