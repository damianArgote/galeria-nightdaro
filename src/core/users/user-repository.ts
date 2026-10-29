import type { AdminUser } from "./user";

export interface UserRepository {
  /** Expects a normalized email (see normalizeEmail). */
  findByEmail(email: string): Promise<AdminUser | null>;
}
