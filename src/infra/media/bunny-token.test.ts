import { describe, expect, it } from "vitest";
import { bunnyToken, SignedUrlService, signBunnyUrl, verifyBunnyToken } from "./bunny-token";

// Vectors from BunnyWay/BunnyCDN.TokenAuthentication nodejs/token.test.js.
const KEY = "SecurityKey";
const EXPIRES = 1598024587;

describe("Bunny token authentication", () => {
  it("matches the official vector for a plain path", () => {
    expect(bunnyToken(KEY, "/abc/", EXPIRES)).toBe(
      "HS256-bTMv4RVOkjx2UXLfVDl-JIygaxfSIQP8UCnCy7CILuY",
    );
  });

  it("matches the official signed URL for a token_path", () => {
    expect(
      signBunnyUrl("https://token-tester.b-cdn.net", "/abc/300kb.jpg", KEY, EXPIRES, "/abc"),
    ).toBe(
      "https://token-tester.b-cdn.net/abc/300kb.jpg?token=HS256-uVZvT3SbEoVKYJyDJgbcsDmSFf73cv-uNUVaJiKWpbQ&token_path=%2Fabc&expires=1598024587",
    );
  });

  it("signs public keys with a one hour expiry the CDN can verify", () => {
    const now = new Date("2026-10-30T12:00:00.000Z");
    const signer = new SignedUrlService({
      baseUrl: "https://cdn.example.com",
      pathPrefix: "",
      securityKey: KEY,
    });

    const url = new URL(
      signer.sign("nightdaro/artworks/a/b/thumb.webp", new Date(now.getTime() + 3600_000)),
    );

    expect(url.pathname).toBe("/nightdaro/artworks/a/b/thumb.webp");
    expect(url.searchParams.get("expires")).toBe(String(now.getTime() / 1000 + 3600));
    const check = (at: Date) =>
      verifyBunnyToken(
        KEY,
        url.pathname,
        url.searchParams.get("token"),
        url.searchParams.get("expires"),
        at,
      );
    expect(check(now)).toBe(true);
    expect(check(new Date(now.getTime() + 3599_000))).toBe(true);
    expect(check(new Date(now.getTime() + 3600_000))).toBe(false);
  });

  it("rejects a token for another path, another key or a changed expiry", () => {
    const expires = String(EXPIRES);
    const token = bunnyToken(KEY, "/a.webp", EXPIRES);
    const before = new Date((EXPIRES - 10) * 1000);

    expect(verifyBunnyToken(KEY, "/a.webp", token, expires, before)).toBe(true);
    expect(verifyBunnyToken(KEY, "/b.webp", token, expires, before)).toBe(false);
    expect(verifyBunnyToken("other", "/a.webp", token, expires, before)).toBe(false);
    expect(verifyBunnyToken(KEY, "/a.webp", token, String(EXPIRES + 60), before)).toBe(false);
    expect(verifyBunnyToken(KEY, "/a.webp", null, expires, before)).toBe(false);
  });
});
