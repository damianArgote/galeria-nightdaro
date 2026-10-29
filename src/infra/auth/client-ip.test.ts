import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

describe("clientIp", () => {
  it("uses the last X-Forwarded-For entry, added by the closest proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" });
    expect(clientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to X-Real-IP and then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
