import { describe, expect, it, vi } from "vitest";
import { AuthenticateAdmin, MAX_PASSWORD_LENGTH } from "./authenticate-admin";
import type { PasswordHasher } from "./password-hasher";
import type { AdminUser } from "./user";
import type { UserRepository } from "./user-repository";

const daro: AdminUser = { id: "u1", email: "daro@example.com", passwordHash: "hash:secret" };

const users: UserRepository = {
  findByEmail: async (email) => (email === daro.email ? daro : null),
};

const hasher: PasswordHasher = {
  hash: async (password) => `hash:${password}`,
  verify: vi.fn(async (password: string, hash: string | null) => hash === `hash:${password}`),
};

const authenticate = new AuthenticateAdmin(users, hasher);

describe("AuthenticateAdmin", () => {
  it("returns the identity, without the hash, for correct credentials", async () => {
    await expect(
      authenticate.execute({ email: "daro@example.com", password: "secret" }),
    ).resolves.toEqual({ id: "u1", email: "daro@example.com" });
  });

  it("normalizes the email before looking the user up", async () => {
    await expect(
      authenticate.execute({ email: "  Daro@Example.COM ", password: "secret" }),
    ).resolves.toEqual({ id: "u1", email: "daro@example.com" });
  });

  it("rejects a wrong password", async () => {
    await expect(
      authenticate.execute({ email: "daro@example.com", password: "nope" }),
    ).resolves.toBeNull();
  });

  it("rejects an unknown email but still runs the password check", async () => {
    vi.mocked(hasher.verify).mockClear();

    await expect(
      authenticate.execute({ email: "ghost@example.com", password: "secret" }),
    ).resolves.toBeNull();
    expect(hasher.verify).toHaveBeenCalledWith("secret", null);
  });

  it("rejects empty credentials", async () => {
    await expect(authenticate.execute({ email: "", password: "" })).resolves.toBeNull();
  });

  it("rejects credentials that are not text (a file posted to the login form)", async () => {
    vi.mocked(hasher.verify).mockClear();

    await expect(
      authenticate.execute({ email: "daro@example.com", password: new Blob(["secret"]) }),
    ).resolves.toBeNull();
    await expect(
      authenticate.execute({ email: ["daro@example.com"], password: "secret" }),
    ).resolves.toBeNull();
    await expect(authenticate.execute(null)).resolves.toBeNull();
    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it("rejects an oversized password without hashing it", async () => {
    vi.mocked(hasher.verify).mockClear();

    await expect(
      authenticate.execute({
        email: "daro@example.com",
        password: "x".repeat(MAX_PASSWORD_LENGTH + 1),
      }),
    ).resolves.toBeNull();
    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it("rejects an oversized email", async () => {
    vi.mocked(hasher.verify).mockClear();

    await expect(
      authenticate.execute({ email: `${"a".repeat(250)}@example.com`, password: "secret" }),
    ).resolves.toBeNull();
    expect(hasher.verify).not.toHaveBeenCalled();
  });
});
