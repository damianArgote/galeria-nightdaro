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
}
