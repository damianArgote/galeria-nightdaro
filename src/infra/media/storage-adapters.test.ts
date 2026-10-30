import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BunnyStorageAdapter, LocalStorageAdapter } from "./storage-adapters";

describe("LocalStorageAdapter", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "nightdaro-local-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes, reads and deletes inside its zone", async () => {
    const storage = new LocalStorageAdapter(root);
    await storage.put("public", "nightdaro/a/thumb.webp", new Uint8Array([1, 2]));

    expect(await storage.read("public", "nightdaro/a/thumb.webp")).toEqual(Buffer.from([1, 2]));
    expect(await storage.read("originals", "nightdaro/a/thumb.webp")).toBeNull();
    await storage.delete("public", "nightdaro/a/thumb.webp");
    expect(await storage.read("public", "nightdaro/a/thumb.webp")).toBeNull();
  });

  it.each(["../originals/x.jpg", "nightdaro/../../etc/passwd", "/etc/passwd", "a//b", ""])(
    "rejects the key %j",
    async (key) => {
      const storage = new LocalStorageAdapter(root);
      await expect(storage.read("public", key)).rejects.toThrow("Invalid storage key");
    },
  );
});

describe("BunnyStorageAdapter", () => {
  it("PUTs to the zone with its own AccessKey", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 201 }));
    const storage = new BunnyStorageAdapter({
      host: "storage.bunnycdn.com",
      zones: {
        originals: { name: "nd-originals", accessKey: "orig-key" },
        public: { name: "nd-public", accessKey: "pub-key" },
      },
      fetch,
    });

    await storage.put("originals", "nightdaro/a/original.jpg", new Uint8Array([1]), "image/jpeg");

    expect(fetch).toHaveBeenCalledWith(
      "https://storage.bunnycdn.com/nd-originals/nightdaro/a/original.jpg",
      expect.objectContaining({
        method: "PUT",
        headers: { AccessKey: "orig-key", "Content-Type": "image/jpeg" },
      }),
    );
  });

  it("fails loudly when Bunny does not answer 201", async () => {
    const storage = new BunnyStorageAdapter({
      host: "storage.bunnycdn.com",
      zones: {
        originals: { name: "o", accessKey: "k" },
        public: { name: "p", accessKey: "k" },
      },
      fetch: async () => new Response(null, { status: 401 }),
    });

    await expect(
      storage.put("public", "k/x.webp", new Uint8Array([1]), "image/webp"),
    ).rejects.toThrow("failed with 401");
  });
});
