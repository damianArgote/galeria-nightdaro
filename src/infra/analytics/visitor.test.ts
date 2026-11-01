import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionHash, visitorFrom } from "./visitor";

const IP = "203.0.113.7";
const UA = "Mozilla/5.0 Chrome/130";
const DAY1 = new Date("2026-11-01T10:00:00.000Z");
const DAY1_LATER = new Date("2026-11-01T23:59:00.000Z");
const DAY2 = new Date("2026-11-02T00:01:00.000Z");

afterEach(() => vi.unstubAllEnvs());

describe("sessionHash", () => {
  const hash = (overrides: Partial<Parameters<typeof sessionHash>[0]> = {}) =>
    sessionHash({ ip: IP, userAgent: UA, salt: "salt", now: DAY1, ...overrides });

  it("is a 32 character hex string that never contains the IP", () => {
    expect(hash()).toMatch(/^[0-9a-f]{32}$/);
    expect(hash()).not.toContain(IP);
    expect(hash()).not.toContain(IP.replaceAll(".", ""));
  });

  it("is stable within a day and changes the next day", () => {
    expect(hash({ now: DAY1_LATER })).toBe(hash());
    expect(hash({ now: DAY2 })).not.toBe(hash());
  });

  it("depends on the IP, the user agent and the secret salt", () => {
    expect(hash({ ip: "203.0.113.8" })).not.toBe(hash());
    expect(hash({ userAgent: "Firefox" })).not.toBe(hash());
    expect(hash({ salt: "other" })).not.toBe(hash());
  });
});

describe("visitorFrom", () => {
  it("keeps the hash and the country, never the IP", () => {
    vi.stubEnv("ANALYTICS_SALT", "salt");
    const headers = new Headers({
      "x-forwarded-for": `6.6.6.6, ${IP}`,
      "user-agent": UA,
      "cf-ipcountry": "ar",
    });

    const visitor = visitorFrom(headers, DAY1);

    expect(visitor).toEqual({
      sessionHash: sessionHash({ ip: IP, userAgent: UA, salt: "salt", now: DAY1 }),
      country: "AR",
    });
    expect(JSON.stringify(visitor)).not.toContain(IP);
  });

  it("requires a secret salt in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANALYTICS_SALT", "");

    expect(() => visitorFrom(new Headers())).toThrow("ANALYTICS_SALT");
  });
});
