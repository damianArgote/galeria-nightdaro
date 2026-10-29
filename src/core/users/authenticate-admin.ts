import type { PasswordHasher } from "./password-hasher";
import { normalizeEmail, type AdminIdentity } from "./user";
import type { UserRepository } from "./user-repository";

export interface AuthenticateAdminInput {
  email: string;
  password: string;
}

export class AuthenticateAdmin {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Returns the admin identity when the credentials match, otherwise null. */
  async execute({ email, password }: AuthenticateAdminInput): Promise<AdminIdentity | null> {
    if (!email || !password) return null;

    const user = await this.users.findByEmail(normalizeEmail(email));
    const valid = await this.hasher.verify(password, user?.passwordHash ?? null);

    return user && valid ? { id: user.id, email: user.email } : null;
  }
}
