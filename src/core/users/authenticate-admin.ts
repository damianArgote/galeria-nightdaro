import { z } from "zod";
import type { PasswordHasher } from "./password-hasher";
import { normalizeEmail, normalizeUsername, toIdentity, type AdminIdentity } from "./user";
import type { UserRepository } from "./user-repository";

/** Argon2 hashes the whole password: an unbounded one is a cheap way to burn CPU. */
export const MAX_PASSWORD_LENGTH = 1024;

/**
 * The login form posts anything; only two bounded strings reach the password check. `username`
 * also takes the email of an admin created before usernames.
 */
export const authenticateAdminSchema = z.object({
  username: z.string().min(1).max(254),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});
export type AuthenticateAdminInput = z.input<typeof authenticateAdminSchema>;

export class AuthenticateAdmin {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Returns the admin identity when the credentials match an active admin, otherwise null. */
  async execute(input: unknown): Promise<AdminIdentity | null> {
    const parsed = authenticateAdminSchema.safeParse(input);
    if (!parsed.success) return null;
    const { username, password } = parsed.data;

    const user = username.includes("@")
      ? await this.users.findByEmail(normalizeEmail(username))
      : await this.users.findByUsername(normalizeUsername(username));
    // Always verified, so unknown and disabled users take as long as real ones.
    const valid = await this.hasher.verify(password, user?.passwordHash ?? null);

    return user && valid && !user.disabledAt ? toIdentity(user) : null;
  }
}
