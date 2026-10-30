import { describe, expect, it, vi } from "vitest";
import {
  BunnyStreamAdapter,
  embedToken,
  tusSignature,
  verifyStreamWebhook,
} from "./bunny-stream-adapter";

// Reference values computed with sha256sum / openssl, not with this code.
describe("Bunny Stream signatures", () => {
  it("signs TUS uploads as sha256(library_id + api_key + expiration + video_id)", () => {
    expect(tusSignature("12345", "stream-api-key", 1700000000, "abc-123")).toBe(
      "9404b05ed22d05eccd8f557e14bdcd2b36ba774925d75d3ecf5299bc4429290d",
    );
  });

  it("signs the player as sha256_hex(token_key + video_id + expiration)", () => {
    expect(embedToken("embed-key-xyz", "abc-123", 1700000000)).toBe(
      "724ad5a244764997138ba657af458604639297f6fa3c5a1ef85fa2bcbde7ffa0",
    );
  });

  it("verifies webhook HMACs over the raw body", () => {
    const body = '{"VideoLibraryId":12345,"VideoGuid":"abc-123","Status":3}';
    const signature = "be6a2887865169e358c13acb482aa8dd525e2a4b609f54413e459d0879fcbfa0";

    expect(verifyStreamWebhook(body, signature, "readonly-key")).toBe(true);
    expect(verifyStreamWebhook(body.replace("3}", "4}"), signature, "readonly-key")).toBe(false);
    expect(verifyStreamWebhook(body, signature, "other-key")).toBe(false);
    expect(verifyStreamWebhook(body, null, "readonly-key")).toBe(false);
    expect(verifyStreamWebhook(body, "not-hex", "readonly-key")).toBe(false);
  });
});

describe("BunnyStreamAdapter", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("creates a video with the library AccessKey", async () => {
    const fetch = vi.fn(async () => json({ guid: "abc-123" }));
    const stream = new BunnyStreamAdapter({
      libraryId: "12345",
      apiKey: "k",
      tokenKey: "t",
      fetch,
    });

    await expect(stream.createVideo("Timelapse")).resolves.toEqual({ videoId: "abc-123" });
    expect(fetch).toHaveBeenCalledWith(
      "https://video.bunnycdn.com/library/12345/videos",
      expect.objectContaining({
        method: "POST",
        body: '{"title":"Timelapse"}',
        headers: expect.objectContaining({ AccessKey: "k" }),
      }),
    );
  });

  it.each([
    [0, "processing"],
    [3, "processing"],
    [4, "ready"],
    [5, "failed"],
    [6, "failed"],
  ])("maps Bunny status %i to %s", async (status, expected) => {
    const stream = new BunnyStreamAdapter({
      libraryId: "1",
      apiKey: "k",
      tokenKey: "t",
      fetch: async () => json({ status }),
    });

    await expect(stream.getStatus("v")).resolves.toBe(expected);
  });

  it("builds a signed TUS authorization and player URL", () => {
    const stream = new BunnyStreamAdapter({
      libraryId: "12345",
      apiKey: "stream-api-key",
      tokenKey: "embed-key-xyz",
    });
    const at = new Date(1700000000 * 1000);

    expect(stream.authorizeUpload("abc-123", at)).toEqual({
      endpoint: "https://video.bunnycdn.com/tusupload",
      videoId: "abc-123",
      libraryId: "12345",
      expires: 1700000000,
      signature: "9404b05ed22d05eccd8f557e14bdcd2b36ba774925d75d3ecf5299bc4429290d",
    });
    expect(stream.playerUrl("abc-123", at)).toBe(
      "https://iframe.mediadelivery.net/embed/12345/abc-123?token=724ad5a244764997138ba657af458604639297f6fa3c5a1ef85fa2bcbde7ffa0&expires=1700000000",
    );
  });
});
