import type { StoragePort, StorageZone } from "@/core/media/ports";

/** In-memory StoragePort for tests; `files` is keyed by "zone:key". */
export class MemoryStorage implements StoragePort {
  readonly files = new Map<string, Uint8Array>();
  failDeletes = false;

  async put(zone: StorageZone, key: string, data: Uint8Array) {
    this.files.set(`${zone}:${key}`, data);
  }

  async get(zone: StorageZone, key: string) {
    return this.files.get(`${zone}:${key}`) ?? null;
  }

  async delete(zone: StorageZone, key: string) {
    if (this.failDeletes) throw new Error(`delete failed: ${zone}:${key}`);
    this.files.delete(`${zone}:${key}`);
  }
}
