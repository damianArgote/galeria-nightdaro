import { afterEach, describe, expect, it, vi } from "vitest";
import { storageDriver, tokenKey } from "./media-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("storage configuration", () => {
  it("refuses to guess the driver in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORAGE_DRIVER", "");

    expect(() => storageDriver()).toThrow("STORAGE_DRIVER must be set in production");
  });

  it("defaults to local storage outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STORAGE_DRIVER", "");

    expect(storageDriver()).toBe("local");
  });

  it("requires the real token key with Bunny", () => {
    vi.stubEnv("STORAGE_DRIVER", "bunny");
    vi.stubEnv("BUNNY_TOKEN_KEY", "");

    expect(() => tokenKey()).toThrow("BUNNY_TOKEN_KEY");
  });

  it("rejects an unknown driver", () => {
    vi.stubEnv("STORAGE_DRIVER", "s3");

    expect(() => storageDriver()).toThrow('STORAGE_DRIVER must be "local" or "bunny"');
  });
});
