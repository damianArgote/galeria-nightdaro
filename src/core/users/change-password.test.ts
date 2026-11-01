import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { FakeUserRepository } from "@/infra/users/fake-user-repository";
import { ConflictError } from "../shared/errors";
import { ChangeOwnPassword } from "./change-password";
import type { PasswordHasher } from "./password-hasher";
import type { AdminUser } from "./user";

const hasher: PasswordHasher = {
  hash: async (password) => `hash:${password}`,
  verify: async (password, hash) => hash === `hash:${password}`,
};
const luna: AdminUser = {
  id: "u2",
  username: "luna",
  email: null,
  passwordHash: "hash:Temp-1234-abcd",
  role: "admin",
  mustChangePassword: true,
  disabledAt: null,
  sessionVersion: 1,
};

let users: FakeUserRepository;
let change: ChangeOwnPassword;

beforeEach(async () => {
  users = new FakeUserRepository();
  await users.save(luna);
  change = new ChangeOwnPassword(users, hasher);
});

describe("ChangeOwnPassword", () => {
  it("stores the new password, clears the temporary flag and ends the other sessions", async () => {
    await change.execute("u2", {
      currentPassword: "Temp-1234-abcd",
      newPassword: "una frase larga y propia",
    });

    expect(await users.findById("u2")).toMatchObject({
      passwordHash: "hash:una frase larga y propia",
      mustChangePassword: false,
      sessionVersion: 2,
    });
  });

  it("rejects a wrong current password without changing anything", async () => {
    await expect(
      change.execute("u2", { currentPassword: "nope", newPassword: "una frase larga y propia" }),
    ).rejects.toMatchObject({ field: "currentPassword" });
    expect(await users.findById("u2")).toEqual(luna);
  });

  it("rejects a new password shorter than 12 characters or equal to the current one", async () => {
    await expect(
      change.execute("u2", { currentPassword: "Temp-1234-abcd", newPassword: "corta" }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      change.execute("u2", { currentPassword: "Temp-1234-abcd", newPassword: "Temp-1234-abcd" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await users.findById("u2")).toEqual(luna);
  });

  it("does not undo a disable or reset that happened while the password was being changed", async () => {
    const realFind = users.findById.bind(users);
    users.findById = async (id) => {
      const read = await realFind(id);
      // The owner resets this admin right after our read.
      await users.save({
        ...read!,
        sessionVersion: read!.sessionVersion + 1,
        disabledAt: new Date(),
      });
      return read;
    };
    await expect(
      change.execute("u2", {
        currentPassword: "Temp-1234-abcd",
        newPassword: "una frase larga y propia",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await realFind("u2"))?.disabledAt).not.toBeNull();
  });

  it("refuses a disabled or unknown admin", async () => {
    await users.save({ ...luna, disabledAt: new Date() });
    await expect(
      change.execute("u2", {
        currentPassword: "Temp-1234-abcd",
        newPassword: "una frase larga y propia",
      }),
    ).rejects.toThrow();
    await expect(
      change.execute("ghost", { currentPassword: "x", newPassword: "una frase larga y propia" }),
    ).rejects.toThrow();
  });
});
