import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeUserRepository } from "@/infra/users/fake-user-repository";
import { AuthenticateAdmin, MAX_PASSWORD_LENGTH } from "./authenticate-admin";
import type { PasswordHasher } from "./password-hasher";
import type { AdminUser } from "./user";

const daro: AdminUser = {
  id: "u1",
  username: "daro",
  email: "daro@example.com",
  passwordHash: "hash:secret",
  role: "owner",
  mustChangePassword: false,
  disabledAt: null,
  sessionVersion: 3,
};
const identity = {
  id: "u1",
  username: "daro",
  role: "owner",
  mustChangePassword: false,
  sessionVersion: 3,
};

const hasher: PasswordHasher = {
  hash: async (password) => `hash:${password}`,
  verify: vi.fn(async (password: string, hash: string | null) => hash === `hash:${password}`),
};

let users: FakeUserRepository;
let authenticate: AuthenticateAdmin;

beforeEach(async () => {
  users = new FakeUserRepository();
  await users.save(daro);
  await users.save({
    ...daro,
    id: "u2",
    username: "luna",
    email: null,
    role: "admin",
    passwordHash: "hash:temp",
    mustChangePassword: true,
  });
  authenticate = new AuthenticateAdmin(users, hasher);
  vi.mocked(hasher.verify).mockClear();
});

describe("AuthenticateAdmin", () => {
  it("logs in with the username, normalized, and returns the identity without the hash", async () => {
    await expect(
      authenticate.execute({ username: "  Daro ", password: "secret" }),
    ).resolves.toEqual(identity);
  });

  it("still accepts the email of an admin created before usernames", async () => {
    await expect(
      authenticate.execute({ username: "  Daro@Example.COM ", password: "secret" }),
    ).resolves.toEqual(identity);
  });

  it("lets an admin with a temporary password in, flagged to change it", async () => {
    await expect(
      authenticate.execute({ username: "luna", password: "temp" }),
    ).resolves.toMatchObject({
      username: "luna",
      role: "admin",
      mustChangePassword: true,
    });
  });

  it("rejects a wrong password", async () => {
    await expect(authenticate.execute({ username: "daro", password: "nope" })).resolves.toBeNull();
  });

  it("rejects an unknown user but still runs the password check", async () => {
    await expect(
      authenticate.execute({ username: "ghost", password: "secret" }),
    ).resolves.toBeNull();
    expect(hasher.verify).toHaveBeenCalledWith("secret", null);
  });

  it("rejects a disabled admin even with the right password, after the same password check", async () => {
    await users.save({ ...daro, disabledAt: new Date("2026-11-01T00:00:00Z") });
    await expect(
      authenticate.execute({ username: "daro", password: "secret" }),
    ).resolves.toBeNull();
    expect(hasher.verify).toHaveBeenCalledWith("secret", "hash:secret");
  });

  it("rejects empty credentials", async () => {
    await expect(authenticate.execute({ username: "", password: "" })).resolves.toBeNull();
  });

  it("rejects credentials that are not text (a file posted to the login form)", async () => {
    await expect(
      authenticate.execute({ username: "daro", password: new Blob(["secret"]) }),
    ).resolves.toBeNull();
    await expect(
      authenticate.execute({ username: ["daro"], password: "secret" }),
    ).resolves.toBeNull();
    await expect(authenticate.execute(null)).resolves.toBeNull();
    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it("rejects an oversized password without hashing it", async () => {
    await expect(
      authenticate.execute({ username: "daro", password: "x".repeat(MAX_PASSWORD_LENGTH + 1) }),
    ).resolves.toBeNull();
    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it("rejects an oversized login", async () => {
    await expect(
      authenticate.execute({ username: `${"a".repeat(250)}@example.com`, password: "secret" }),
    ).resolves.toBeNull();
    expect(hasher.verify).not.toHaveBeenCalled();
  });
});
