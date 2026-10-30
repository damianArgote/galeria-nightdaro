import { LocalStorageAdapter } from "@/infra/media/storage-adapters";
import { verifyBunnyToken } from "@/infra/media/bunny-token";
import {
  DEV_MEDIA_PATH,
  localStorageRoot,
  storageDriver,
  tokenKey,
} from "@/infra/media/media-config";

/**
 * Stands in for the Bunny Pull Zone in development: serves only the public zone, only with a
 * valid, unexpired token. Does not exist when STORAGE_DRIVER=bunny.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (storageDriver() !== "local") return new Response("Not found", { status: 404 });

  const key = (await params).key.join("/");
  const url = new URL(request.url);
  const valid = verifyBunnyToken(
    tokenKey(),
    `${DEV_MEDIA_PATH}/${key}`,
    url.searchParams.get("token"),
    url.searchParams.get("expires"),
  );
  if (!valid) return new Response("Forbidden", { status: 403 });

  let data: Uint8Array | null;
  try {
    data = await new LocalStorageAdapter(localStorageRoot()).get("public", key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(data as BodyInit, {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=600" },
  });
}
