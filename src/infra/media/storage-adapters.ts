import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { StoragePort, StorageZone } from "@/core/media/ports";

/** Rejects keys that could escape their zone (`..`, absolute paths, empty segments). */
export function assertSafeKey(key: string): void {
  const segments = key.split("/");
  const valid = segments.every((s) => /^[A-Za-z0-9._-]+$/.test(s) && s !== "." && s !== "..");
  if (!key || !valid) throw new Error(`Invalid storage key: ${key}`);
}

/** Files on disk under `<root>/<zone>/<key>`, for development and tests. */
export class LocalStorageAdapter implements StoragePort {
  constructor(private readonly root: string) {}

  async put(zone: StorageZone, key: string, data: Uint8Array): Promise<void> {
    const path = this.pathFor(zone, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async delete(zone: StorageZone, key: string): Promise<void> {
    await rm(this.pathFor(zone, key), { force: true });
  }

  async get(zone: StorageZone, key: string): Promise<Uint8Array | null> {
    const path = this.pathFor(zone, key);
    try {
      return new Uint8Array(await readFile(path));
    } catch {
      return null;
    }
  }

  private pathFor(zone: StorageZone, key: string): string {
    assertSafeKey(key);
    const zoneRoot = resolve(this.root, zone);
    const path = resolve(zoneRoot, key);
    if (!path.startsWith(zoneRoot + sep)) throw new Error(`Invalid storage key: ${key}`);
    return join(path);
  }
}

export interface BunnyZoneConfig {
  name: string;
  accessKey: string;
}

/**
 * Bunny Storage HTTP API: PUT/DELETE https://{host}/{zone}/{key} with the zone password in
 * `AccessKey` (https://docs.bunny.net/reference/put_-storagezonename-path-filename).
 */
export class BunnyStorageAdapter implements StoragePort {
  constructor(
    private readonly config: {
      host: string;
      zones: Record<StorageZone, BunnyZoneConfig>;
      fetch?: typeof fetch;
    },
  ) {}

  async put(zone: StorageZone, key: string, data: Uint8Array, contentType: string) {
    const response = await this.request("PUT", zone, key, {
      body: data,
      headers: { "Content-Type": contentType },
    });
    if (response.status !== 201) {
      throw new Error(`Bunny Storage PUT ${zone}/${key} failed with ${response.status}`);
    }
  }

  async get(zone: StorageZone, key: string): Promise<Uint8Array | null> {
    const response = await this.request("GET", zone, key);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Bunny Storage GET ${zone}/${key} failed with ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(zone: StorageZone, key: string) {
    const response = await this.request("DELETE", zone, key);
    if (!response.ok && response.status !== 404) {
      throw new Error(`Bunny Storage DELETE ${zone}/${key} failed with ${response.status}`);
    }
  }

  private request(
    method: string,
    zone: StorageZone,
    key: string,
    init: { body?: Uint8Array; headers?: Record<string, string> } = {},
  ) {
    assertSafeKey(key);
    const { name, accessKey } = this.config.zones[zone];
    const url = `https://${this.config.host}/${encodeURIComponent(name)}/${key}`;
    return (this.config.fetch ?? fetch)(url, {
      method,
      body: init.body as BodyInit | undefined,
      headers: { AccessKey: accessKey, ...init.headers },
    });
  }
}
