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

    expect(await storage.get("public", "nightdaro/a/thumb.webp")).toEqual(new Uint8Array([1, 2]));
    expect(await storage.get("originals", "nightdaro/a/thumb.webp")).toBeNull();
    await storage.delete("public", "nightdaro/a/thumb.webp");
    expect(await storage.get("public", "nightdaro/a/thumb.webp")).toBeNull();
  });

  it.each(["../originals/x.jpg", "nightdaro/../../etc/passwd", "/etc/passwd", "a//b", ""])(
    "rejects the key %j",
    async (key) => {
      const storage = new LocalStorageAdapter(root);
      await expect(storage.get("public", key)).rejects.toThrow("Invalid storage key");
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

  it("GETs a file, and returns null when Bunny answers 404", async () => {
    const responses = [
      new Response(new Uint8Array([7, 8]), { status: 200 }),
      new Response(null, { status: 404 }),
    ];
    const storage = new BunnyStorageAdapter({
      host: "storage.bunnycdn.com",
      zones: {
        originals: { name: "o", accessKey: "orig-key" },
        public: { name: "p", accessKey: "pub-key" },
      },
      fetch: async () => responses.shift()!,
    });

    expect(await storage.get("originals", "k/original.jpg")).toEqual(new Uint8Array([7, 8]));
    expect(await storage.get("originals", "k/missing.jpg")).toBeNull();
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
