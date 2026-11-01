import { z } from "zod";
import type { PasswordHasher } from "./password-hasher";
import { normalizeEmail, type AdminIdentity } from "./user";
import type { UserRepository } from "./user-repository";

/** Argon2 hashes the whole password: an unbounded one is a cheap way to burn CPU. */
export const MAX_PASSWORD_LENGTH = 1024;

/** The login form posts anything; only two bounded strings reach the password check. */
export const authenticateAdminSchema = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});
export type AuthenticateAdminInput = z.input<typeof authenticateAdminSchema>;

export class AuthenticateAdmin {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Returns the admin identity when the credentials match, otherwise null. */
  async execute(input: unknown): Promise<AdminIdentity | null> {
    const parsed = authenticateAdminSchema.safeParse(input);
    if (!parsed.success) return null;
    const { email, password } = parsed.data;

    const user = await this.users.findByEmail(normalizeEmail(email));
    const valid = await this.hasher.verify(password, user?.passwordHash ?? null);

    return user && valid ? { id: user.id, email: user.email } : null;
  }
}
