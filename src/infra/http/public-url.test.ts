import { afterEach, describe, expect, it, vi } from "vitest";
import { isSameSiteOrigin, publicUrl } from "./public-url";

// On Render the app sees its internal address, not the public domain.
const internal = (headers: Record<string, string> = {}) =>
  new Request("http://localhost:10000/api/patreon/callback?code=x", { headers });

afterEach(() => vi.unstubAllEnvs());

describe("publicUrl", () => {
  it("builds links on SITE_URL, never on the internal address the request arrived at", () => {
    vi.stubEnv("SITE_URL", "https://www.nightdaro.com");
    expect(publicUrl("/admin/links?patreon=conectado", internal()).href).toBe(
      "https://www.nightdaro.com/admin/links?patreon=conectado",
    );
  });

  it("falls back to the request's own origin without SITE_URL (local dev, tests)", () => {
    vi.stubEnv("SITE_URL", "");
    expect(publicUrl("/admin", internal()).href).toBe("http://localhost:10000/admin");
  });
});

describe("isSameSiteOrigin", () => {
  it("accepts the public domain even though the request URL is internal", () => {
    vi.stubEnv("SITE_URL", "https://www.nightdaro.com");
    expect(isSameSiteOrigin("https://www.nightdaro.com", internal())).toBe(true);
  });

  it("rejects other sites, the apex without www and malformed origins", () => {
    vi.stubEnv("SITE_URL", "https://www.nightdaro.com");
    expect(isSameSiteOrigin("https://evil.example", internal())).toBe(false);
    expect(isSameSiteOrigin("http://www.nightdaro.com", internal())).toBe(false);
    expect(isSameSiteOrigin("https://nightdaro.com", internal())).toBe(false);
    expect(isSameSiteOrigin("not a url", internal())).toBe(false);
  });

  it("compares with the request's origin without SITE_URL", () => {
    vi.stubEnv("SITE_URL", "");
    expect(isSameSiteOrigin("http://localhost:10000", internal())).toBe(true);
    expect(isSameSiteOrigin("http://localhost:3000", internal())).toBe(false);
  });
});
