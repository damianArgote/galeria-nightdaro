import { resolve } from "node:path";
import { requireEnv } from "@/db/env";
import type { StoragePort } from "@/core/media/ports";
import { SignedUrlService } from "./bunny-token";
import { BunnyStorageAdapter, LocalStorageAdapter } from "./storage-adapters";

export const DEV_MEDIA_PATH = "/dev-media";
const LOCAL_TOKEN_KEY = "local-dev-token-key";

export type StorageDriver = "local" | "bunny";

/** `bunny` in production; `local` (files under LOCAL_STORAGE_DIR) for development and tests. */
export function storageDriver(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver !== "local" && driver !== "bunny") {
    throw new Error(`STORAGE_DRIVER must be "local" or "bunny", got "${driver}"`);
  }
  return driver;
}

export function localStorageRoot(): string {
  return resolve(process.env.LOCAL_STORAGE_DIR || ".storage");
}

/** Token key shared by the signer and the local dev route; Bunny's key in production. */
export function tokenKey(): string {
  return storageDriver() === "bunny"
    ? requireEnv("BUNNY_TOKEN_KEY")
    : process.env.BUNNY_TOKEN_KEY || LOCAL_TOKEN_KEY;
}

export function createStorage(): StoragePort {
  if (storageDriver() === "local") return new LocalStorageAdapter(localStorageRoot());

  // Each Bunny storage zone has its own password; BUNNY_STORAGE_KEY covers both when they match.
  const fallback = process.env.BUNNY_STORAGE_KEY;
  const key = (name: string) => process.env[name] || fallback || requireEnv(name);
  return new BunnyStorageAdapter({
    host: process.env.BUNNY_STORAGE_HOST || "storage.bunnycdn.com",
    zones: {
      originals: {
        name: requireEnv("BUNNY_ZONE_ORIGINALS"),
        accessKey: key("BUNNY_STORAGE_KEY_ORIGINALS"),
      },
      public: { name: requireEnv("BUNNY_ZONE_PUBLIC"), accessKey: key("BUNNY_STORAGE_KEY_PUBLIC") },
    },
  });
}

export function createUrlSigner(): SignedUrlService {
  if (storageDriver() === "local") {
    return new SignedUrlService({
      baseUrl: "",
      pathPrefix: DEV_MEDIA_PATH,
      securityKey: tokenKey(),
    });
  }
  return new SignedUrlService({
    baseUrl: `https://${requireEnv("BUNNY_CDN_HOST")}`,
    pathPrefix: "",
    securityKey: tokenKey(),
  });
}
