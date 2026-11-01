import { describe, expect, it } from "vitest";
import { TokenCipher } from "./token-cipher";

describe("TokenCipher (AES-256-GCM)", () => {
  const cipher = new TokenCipher("a-long-random-secret-from-render");

  it("round-trips a token and never stores it in clear", () => {
    const sealed = cipher.encrypt("access-token-123");
    expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(sealed).not.toContain("access-token-123");
    expect(cipher.decrypt(sealed)).toBe("access-token-123");
  });

  it("uses a fresh IV every time", () => {
    expect(cipher.encrypt("same")).not.toBe(cipher.encrypt("same"));
  });

  it("rejects a tampered value and a value sealed with another key", () => {
    const sealed = cipher.encrypt("access-token-123");
    const [v, iv, tag, data] = sealed.split(".");
    const flipped = `${v}.${iv}.${tag}.${data!.slice(0, -2)}${data!.endsWith("A") ? "B" : "A"}${data!.slice(-1)}`;
    expect(() => cipher.decrypt(flipped)).toThrow();
    expect(() => new TokenCipher("another-secret-entirely").decrypt(sealed)).toThrow();
    expect(() => cipher.decrypt("plain-text")).toThrow();
  });

  it("refuses a short secret", () => {
    expect(() => new TokenCipher("short")).toThrow("at least 16");
  });
});
