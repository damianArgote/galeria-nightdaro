import { describe, expect, it } from "vitest";
import { seedAdminsFromEnv } from "./seed-admins";

const base = {
  SEED_DARO_EMAIL: "daro@example.com",
  SEED_DARO_PASSWORD: "daro-secret",
  SEED_DAMI_EMAIL: "dami@example.com",
  SEED_DAMI_PASSWORD: "dami-secret",
};

describe("seedAdminsFromEnv", () => {
  it("returns the two required admins when the third pair is not set", () => {
    expect(seedAdminsFromEnv(base)).toEqual([
      { email: "daro@example.com", password: "daro-secret" },
      { email: "dami@example.com", password: "dami-secret" },
    ]);
  });

  it("adds the third admin when both of its variables are set", () => {
    expect(
      seedAdminsFromEnv({
        ...base,
        SEED_ADMIN3_EMAIL: "third@example.com",
        SEED_ADMIN3_PASSWORD: "third-secret",
      }),
    ).toEqual([
      { email: "daro@example.com", password: "daro-secret" },
      { email: "dami@example.com", password: "dami-secret" },
      { email: "third@example.com", password: "third-secret" },
    ]);
  });

  it("rejects a third admin with only one of its variables", () => {
    expect(() => seedAdminsFromEnv({ ...base, SEED_ADMIN3_EMAIL: "third@example.com" })).toThrow(
      "Missing environment variable SEED_ADMIN3_PASSWORD",
    );
    expect(() => seedAdminsFromEnv({ ...base, SEED_ADMIN3_PASSWORD: "third-secret" })).toThrow(
      "Missing environment variable SEED_ADMIN3_EMAIL",
    );
  });

  it("still requires the first two admins", () => {
    const { SEED_DAMI_PASSWORD: _omitted, ...withoutDami } = base;
    expect(() => seedAdminsFromEnv(withoutDami)).toThrow(
      "Missing environment variable SEED_DAMI_PASSWORD",
    );
  });
});
