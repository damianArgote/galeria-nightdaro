import { z } from "zod";
import { container } from "@/infra/container";
import { verifyStreamWebhook } from "@/infra/media/bunny-stream-adapter";

const payloadSchema = z.object({ VideoGuid: z.string().min(1).max(100) });

/**
 * Bunny Stream webhook. Verifies the v1 signature (HMAC-SHA256 of the raw body with the
 * library's read-only key) and then asks the API for the real status: the payload's Status is
 * never trusted. Disabled unless BUNNY_STREAM_READONLY_KEY is set.
 */
export async function POST(request: Request) {
  const readOnlyKey = process.env.BUNNY_STREAM_READONLY_KEY;
  if (!readOnlyKey) return new Response("Not found", { status: 404 });

  const raw = await request.text();
  if (!verifyStreamWebhook(raw, request.headers.get("x-bunnystream-signature"), readOnlyKey)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(raw));
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  await container.syncVideoStatus?.forVideo(payload.VideoGuid);
  return new Response(null, { status: 204 });
}
