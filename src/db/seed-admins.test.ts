import { describe, expect, it } from "vitest";
import { seedAdminsFromEnv } from "./seed-admins";

describe("seedAdminsFromEnv", () => {
  it("returns the single admin of SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD", () => {
    expect(
      seedAdminsFromEnv({
        SEED_ADMIN_EMAIL: "daro@example.com",
        SEED_ADMIN_PASSWORD: "daro-secret",
      }),
    ).toEqual([{ email: "daro@example.com", password: "daro-secret" }]);
  });

  it("requires both variables", () => {
    expect(() => seedAdminsFromEnv({ SEED_ADMIN_EMAIL: "daro@example.com" })).toThrow(
      "Missing environment variable SEED_ADMIN_PASSWORD",
    );
    expect(() => seedAdminsFromEnv({ SEED_ADMIN_PASSWORD: "daro-secret" })).toThrow(
      "Missing environment variable SEED_ADMIN_EMAIL",
    );
  });

  it("ignores the old per-person variables", () => {
    expect(() =>
      seedAdminsFromEnv({ SEED_DARO_EMAIL: "daro@example.com", SEED_DARO_PASSWORD: "daro-secret" }),
    ).toThrow("Missing environment variable SEED_ADMIN_EMAIL");
  });
});
