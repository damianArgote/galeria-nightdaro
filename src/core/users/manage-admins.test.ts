import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { FakeUserRepository } from "@/infra/users/fake-user-repository";
import { ConflictError, NotFoundError } from "../shared/errors";
import {
  CreateAdmin,
  ListAdmins,
  ResetAdminPassword,
  SetAdminActive,
  TEMPORARY_PASSWORD_PATTERN,
  temporaryPassword,
} from "./manage-admins";
import type { PasswordHasher } from "./password-hasher";
import type { AdminUser } from "./user";

const hasher: PasswordHasher = {
  hash: async (password) => `hash:${password}`,
  verify: async (password, hash) => hash === `hash:${password}`,
};
const owner: AdminUser = {
  id: "99999999-9999-4999-8999-999999999999",
  username: "daro",
  email: null,
  passwordHash: "hash:x",
  role: "owner",
  mustChangePassword: false,
  disabledAt: null,
  sessionVersion: 0,
};
const NOW = new Date("2026-11-02T12:00:00Z");

let users: FakeUserRepository;
let ids: string[];

beforeEach(async () => {
  users = new FakeUserRepository();
  await users.save(owner);
  ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
});

const create = () => new CreateAdmin(users, hasher, () => ids.shift()!);

describe("temporaryPassword", () => {
  it("is long, readable and different every time", () => {
    const a = temporaryPassword();
    expect(a).toMatch(TEMPORARY_PASSWORD_PATTERN);
    expect(a.length).toBeGreaterThanOrEqual(12);
    expect(temporaryPassword()).not.toBe(a);
  });
});

describe("CreateAdmin", () => {
  it("creates an admin with a temporary password that must be changed, shown only in the result", async () => {
    const result = await create().execute({ username: "  Luna " });

    expect(result).toMatchObject({ id: "11111111-1111-4111-8111-111111111111", username: "luna" });
    expect(result.temporaryPassword).toMatch(TEMPORARY_PASSWORD_PATTERN);
    expect(await users.findById("11111111-1111-4111-8111-111111111111")).toMatchObject({
      username: "luna",
      role: "admin",
      mustChangePassword: true,
      disabledAt: null,
      passwordHash: `hash:${result.temporaryPassword}`,
    });
  });

  it("rejects an invalid or taken username", async () => {
    await expect(create().execute({ username: "a b" })).rejects.toBeInstanceOf(ZodError);
    await expect(create().execute({ username: "ab" })).rejects.toBeInstanceOf(ZodError);
    await expect(create().execute({ username: "DARO" })).rejects.toMatchObject({
      field: "username",
    });
  });
});

describe("ResetAdminPassword", () => {
  it("gives a new temporary password and ends the admin's sessions", async () => {
    await create().execute({ username: "luna" });

    const result = await new ResetAdminPassword(users, hasher).execute(
      "99999999-9999-4999-8999-999999999999",
      { id: "11111111-1111-4111-8111-111111111111" },
    );

    expect(await users.findById("11111111-1111-4111-8111-111111111111")).toMatchObject({
      passwordHash: `hash:${result.temporaryPassword}`,
      mustChangePassword: true,
      sessionVersion: 1,
    });
  });

  it("does not reset the owner's own password (that is Cambiar contraseña) nor an unknown admin", async () => {
    const reset = new ResetAdminPassword(users, hasher);
    await expect(
      reset.execute("99999999-9999-4999-8999-999999999999", {
        id: "99999999-9999-4999-8999-999999999999",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      reset.execute("99999999-9999-4999-8999-999999999999", {
        id: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("SetAdminActive", () => {
  it("disables an admin (ending their sessions) and enables them again", async () => {
    await create().execute({ username: "luna" });
    const set = new SetAdminActive(users, () => NOW);

    await set.execute("99999999-9999-4999-8999-999999999999", {
      id: "11111111-1111-4111-8111-111111111111",
      active: false,
    });
    expect(await users.findById("11111111-1111-4111-8111-111111111111")).toMatchObject({
      disabledAt: NOW,
      sessionVersion: 1,
    });

    await set.execute("99999999-9999-4999-8999-999999999999", {
      id: "11111111-1111-4111-8111-111111111111",
      active: true,
    });
    expect(await users.findById("11111111-1111-4111-8111-111111111111")).toMatchObject({
      disabledAt: null,
    });
  });

  it("never lets the owner disable themselves or the last active owner", async () => {
    const set = new SetAdminActive(users, () => NOW);
    await expect(
      set.execute("99999999-9999-4999-8999-999999999999", {
        id: "99999999-9999-4999-8999-999999999999",
        active: false,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await users.save({ ...owner, id: "88888888-8888-4888-8888-888888888888", username: "dami" });
    await users.save({ ...owner, disabledAt: NOW }); // the acting owner was disabled meanwhile
    await expect(
      set.execute("x", { id: "88888888-8888-4888-8888-888888888888", active: false }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("concurrency guards", () => {
  it("refuses to disable the last active owner even when the check raced (the store decides)", async () => {
    // Simulates two owners disabling each other: the use case saw another owner, but by the
    // time it writes, that owner is disabled too.
    const second = { ...owner, id: "77777777-7777-4777-8777-777777777777", username: "dami" };
    await users.save(second);
    await users.save({ ...owner, disabledAt: NOW });
    const racing = new SetAdminActive(
      Object.assign(Object.create(users), {
        list: async () => [owner, second],
        findById: users.findById.bind(users),
        setDisabled: users.setDisabled.bind(users),
      }),
      () => NOW,
    );
    await expect(
      racing.execute("someone-else", { id: second.id, active: false }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await users.findById(second.id))?.disabledAt).toBeNull();
  });
});

describe("ListAdmins", () => {
  it("lists admins without password hashes", async () => {
    await create().execute({ username: "luna" });
    const list = await new ListAdmins(users).execute();
    expect(list.map((a) => [a.username, a.role, a.status])).toEqual([
      ["daro", "owner", "active"],
      ["luna", "admin", "temporary"],
    ]);
    expect(JSON.stringify(list)).not.toContain("hash:");
  });
});
