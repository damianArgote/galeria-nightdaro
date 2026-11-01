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
    await seed(testDb.db, [
      { username: "daro", email: "daro@example.com", password: "daro-secret" },
    ]);
    authenticate = new AuthenticateAdmin(
      new DrizzleUserRepository(testDb.db),
      new Argon2PasswordHasher(),
    );
  });

  afterAll(async () => {
    await testDb?.close();
  });

  it("accepts a seeded admin by username or by email", async () => {
    for (const login of ["Daro", "Daro@Example.com"]) {
      expect(
        await authenticate.execute({ username: login, password: "daro-secret" }),
      ).toMatchObject({ username: "daro", role: "owner", mustChangePassword: false });
    }
  });

  it("rejects a wrong password and an unknown email", async () => {
    await expect(authenticate.execute({ username: "daro", password: "wrong" })).resolves.toBeNull();
    await expect(
      authenticate.execute({ username: "nobody", password: "daro-secret" }),
    ).resolves.toBeNull();
  });

  it("updates the password only while the session version and the active state match", async () => {
    const repository = new DrizzleUserRepository(testDb.db);
    const daro = (await repository.findByUsername("daro"))!;
    const fields = { passwordHash: daro.passwordHash, mustChangePassword: false };

    expect(
      await repository.updatePassword(daro.id, daro.sessionVersion + 7, {
        ...fields,
        sessionVersion: 99,
      }),
    ).toBe(false);
    await repository.save({ ...daro, disabledAt: new Date() });
    expect(
      await repository.updatePassword(daro.id, daro.sessionVersion, {
        ...fields,
        sessionVersion: 99,
      }),
    ).toBe(false);
    await repository.save(daro);
    expect(
      await repository.updatePassword(daro.id, daro.sessionVersion, {
        ...fields,
        sessionVersion: daro.sessionVersion + 1,
      }),
    ).toBe(true);
    expect((await repository.findById(daro.id))?.sessionVersion).toBe(daro.sessionVersion + 1);
  });

  it("disables, re-enables and resets an admin, bumping the session version each time", async () => {
    const repository = new DrizzleUserRepository(testDb.db);
    const daro = (await repository.findByUsername("daro"))!;
    const at = new Date("2026-11-02T12:00:00Z");

    expect(await repository.setDisabled(daro.id, at)).toBe(true);
    expect(await repository.findById(daro.id)).toMatchObject({
      disabledAt: at,
      sessionVersion: daro.sessionVersion + 1,
    });
    expect(await repository.setDisabled(daro.id, null)).toBe(true);
    expect(await repository.resetPassword(daro.id, "new-hash")).toBe(true);
    expect(await repository.findById(daro.id)).toMatchObject({
      disabledAt: null,
      passwordHash: "new-hash",
      mustChangePassword: true,
      sessionVersion: daro.sessionVersion + 3,
    });
    expect(await repository.setDisabled("00000000-0000-4000-8000-000000000000", at)).toBe(false);
  });
});
