import { describe, expect, it } from "vitest";
import { seedAdminsFromEnv } from "./seed-admins";

describe("seedAdminsFromEnv", () => {
  it("creates the owner from SEED_ADMIN_USERNAME, normalized", () => {
    expect(
      seedAdminsFromEnv({ SEED_ADMIN_USERNAME: " Daro ", SEED_ADMIN_PASSWORD: "daro-secret" }),
    ).toEqual([{ username: "daro", password: "daro-secret" }]);
  });

  it("still accepts SEED_ADMIN_EMAIL: the part before @ becomes the username", () => {
    expect(
      seedAdminsFromEnv({ SEED_ADMIN_EMAIL: "Daro.Art@example.com", SEED_ADMIN_PASSWORD: "x" }),
    ).toEqual([{ username: "daro.art", email: "Daro.Art@example.com", password: "x" }]);
  });

  it("requires a password and a username or email", () => {
    expect(() => seedAdminsFromEnv({ SEED_ADMIN_USERNAME: "daro" })).toThrow(
      "Missing environment variable SEED_ADMIN_PASSWORD",
    );
    expect(() => seedAdminsFromEnv({ SEED_ADMIN_PASSWORD: "x" })).toThrow(
      "Missing environment variable SEED_ADMIN_USERNAME",
    );
  });

  it("rejects an invalid username", () => {
    expect(() =>
      seedAdminsFromEnv({ SEED_ADMIN_USERNAME: "da ro!", SEED_ADMIN_PASSWORD: "x" }),
    ).toThrow(/SEED_ADMIN_USERNAME/);
  });
});
