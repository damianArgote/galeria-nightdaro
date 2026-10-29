import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limiter";

function limiterAt(start = 0) {
  const clock = { now: start };
  const limiter = new RateLimiter({ limit: 5, windowMs: 60_000, now: () => clock.now });
  return { limiter, clock };
}

describe("RateLimiter", () => {
  it("allows 5 attempts per minute and blocks the 6th", () => {
    const { limiter } = limiterAt();

    const results = Array.from({ length: 6 }, () => limiter.consume("1.2.3.4"));

    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it("allows attempts again once the minute has passed", () => {
    const { limiter, clock } = limiterAt();
    for (let i = 0; i < 6; i++) limiter.consume("1.2.3.4");

    clock.now += 60_000;

    expect(limiter.consume("1.2.3.4")).toBe(true);
  });

  it("keeps a separate budget per key", () => {
    const { limiter } = limiterAt();
    for (let i = 0; i < 6; i++) limiter.consume("1.2.3.4");

    expect(limiter.consume("5.6.7.8")).toBe(true);
  });
});
