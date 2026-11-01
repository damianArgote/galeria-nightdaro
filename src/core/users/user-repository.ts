import type { AdminUser } from "./user";

export interface UserRepository {
  findById(id: string): Promise<AdminUser | null>;
  /** Expects a normalized username (see normalizeUsername). */
  findByUsername(username: string): Promise<AdminUser | null>;
  /** Expects a normalized email (see normalizeEmail). */
  findByEmail(email: string): Promise<AdminUser | null>;
  list(): Promise<AdminUser[]>;
  /** Inserts or replaces by id. */
  save(user: AdminUser): Promise<void>;
  /**
   * Writes only the password fields, and only if the session version is still the one read
   * (nothing disabled or reset the admin meanwhile). False when it was not written.
   */
  /** Disables (a date) or re-enables (null) the admin; bumps the session version atomically. */
  setDisabled(id: string, disabledAt: Date | null): Promise<boolean>;
  /** A new temporary password that must be changed; bumps the session version atomically. */
  resetPassword(id: string, passwordHash: string): Promise<boolean>;
  updatePassword(
    id: string,
    expectedVersion: number,
    fields: Pick<AdminUser, "passwordHash" | "mustChangePassword" | "sessionVersion">,
  ): Promise<boolean>;
}
