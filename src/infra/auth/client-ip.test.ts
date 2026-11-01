import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp } from "./client-ip";

afterEach(() => vi.unstubAllEnvs());

describe("clientIp", () => {
  it("uses the last X-Forwarded-For entry when no trusted header is configured", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" });
    expect(clientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to X-Real-IP and then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("uses the configured header set by the platform's proxy (CF-Connecting-IP on Render)", () => {
    vi.stubEnv("CLIENT_IP_HEADER", "cf-connecting-ip");
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.7",
      // Render appends its own proxy last; a client can prepend anything.
      "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.1",
    });

    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("ignores a configured header that is missing or not an IP", () => {
    vi.stubEnv("CLIENT_IP_HEADER", "cf-connecting-ip");

    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(
      clientIp(new Headers({ "cf-connecting-ip": "not an ip", "x-forwarded-for": "1.2.3.4" })),
    ).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });
});
