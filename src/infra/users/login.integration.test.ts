import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthenticateAdmin } from "@/core/users/authenticate-admin";
import { seed } from "@/db/seed";
import { Argon2PasswordHasher } from "@/infra/auth/argon2-password-hasher";
import { createTestDb, databaseUrl } from "../../../tests/helpers/test-db";
import { DrizzleUserRepository } from "./drizzle-user-repository";

describe.skipIf(!databaseUrl)("admin login against Postgres", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let authenticate: AuthenticateAdmin;

  beforeAll(async () => {
    testDb = await createTestDb("login");
    await testDb.reset();
    await seed(testDb.db, [{ email: "daro@example.com", password: "daro-secret" }]);
    authenticate = new AuthenticateAdmin(
      new DrizzleUserRepository(testDb.db),
      new Argon2PasswordHasher(),
    );
  });

  afterAll(async () => {
    await testDb?.close();
  });

  it("accepts a seeded admin with the right password", async () => {
    const identity = await authenticate.execute({
      email: "Daro@Example.com",
      password: "daro-secret",
    });
    expect(identity).toMatchObject({ email: "daro@example.com" });
  });

  it("rejects a wrong password and an unknown email", async () => {
    await expect(
      authenticate.execute({ email: "daro@example.com", password: "wrong" }),
    ).resolves.toBeNull();
    await expect(
      authenticate.execute({ email: "nobody@example.com", password: "daro-secret" }),
    ).resolves.toBeNull();
  });
});
