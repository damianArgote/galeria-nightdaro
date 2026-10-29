import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "@/core/users/password-hasher";

// @node-rs/argon2 defaults to argon2id (OWASP-recommended parameters).
export class Argon2PasswordHasher implements PasswordHasher {
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(password: string, passwordHash: string | null): Promise<boolean> {
    if (passwordHash === null) {
      // Same cost as a real check, so unknown emails are not faster to reject.
      this.dummyHash ??= hash("timing-equalizer");
      await verify(await this.dummyHash, password);
      return false;
    }
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
