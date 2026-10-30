import type { MediaAsset } from "./media-asset";
import type { StoragePort, StorageZone } from "./ports";

export function assetFiles(asset: MediaAsset): { zone: StorageZone; key: string }[] {
  const files: [StorageZone, string | null][] = [
    ["originals", asset.originalKey],
    ["originals", asset.censoredKey],
    ["public", asset.thumbKey],
    ["public", asset.previewKey],
  ];
  return files.flatMap(([zone, key]) => (key ? [{ zone, key }] : []));
}

/**
 * Best effort: a file that cannot be deleted is left behind (private or unlisted), never a row
 * pointing at missing files. Returns the files that could not be deleted.
 */
export async function deleteFiles(
  storage: StoragePort,
  files: { zone: StorageZone; key: string }[],
): Promise<{ zone: StorageZone; key: string }[]> {
  const results = await Promise.allSettled(files.map(({ zone, key }) => storage.delete(zone, key)));
  return files.filter((_, i) => results[i]!.status === "rejected");
}
