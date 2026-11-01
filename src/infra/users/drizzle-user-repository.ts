import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { AdminUser } from "@/core/users/user";
import type { UserRepository } from "@/core/users/user-repository";
import { ConflictError } from "@/core/shared/errors";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";

const columns = {
  id: users.id,
  username: users.username,
  email: users.email,
  passwordHash: users.passwordHash,
  role: users.role,
  mustChangePassword: users.mustChangePassword,
  disabledAt: users.disabledAt,
  sessionVersion: users.sessionVersion,
};

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = (error as { cause?: { code?: string; constraint_name?: string } })?.cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string };
  return pg.code === "23505" && pg.constraint_name === constraint;
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  private async one(where: ReturnType<typeof eq>): Promise<AdminUser | null> {
    const [row] = await this.db.select(columns).from(users).where(where);
    return row ?? null;
  }

  findById(id: string) {
    return this.one(eq(users.id, id));
  }

  findByUsername(username: string) {
    return this.one(eq(users.username, username));
  }

  findByEmail(email: string) {
    return this.one(eq(users.email, email));
  }

  list(): Promise<AdminUser[]> {
    return this.db.select(columns).from(users).orderBy(asc(users.createdAt));
  }

  async setDisabled(id: string, disabledAt: Date | null): Promise<boolean> {
    // Disabling an owner only goes through if another active owner exists at write time.
    const keepsAnOwner = sql`(${users.role} <> 'owner' OR EXISTS (
      SELECT 1 FROM ${users} AS other
      WHERE other.role = 'owner' AND other.disabled_at IS NULL AND other.id <> ${id}
    ))`;
    const updated = await this.db
      .update(users)
      .set({ disabledAt, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(disabledAt ? and(eq(users.id, id), keepsAnOwner) : eq(users.id, id))
      .returning({ id: users.id });
    return updated.length > 0;
  }

  async resetPassword(id: string, passwordHash: string): Promise<boolean> {
    const updated = await this.db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return updated.length > 0;
  }

  async updatePassword(
    id: string,
    expectedVersion: number,
    fields: Pick<AdminUser, "passwordHash" | "mustChangePassword" | "sessionVersion">,
  ): Promise<boolean> {
    const updated = await this.db
      .update(users)
      .set(fields)
      .where(
        and(eq(users.id, id), eq(users.sessionVersion, expectedVersion), isNull(users.disabledAt)),
      )
      .returning({ id: users.id });
    return updated.length > 0;
  }

  async save(user: AdminUser): Promise<void> {
    try {
      await this.db.insert(users).values(user).onConflictDoUpdate({ target: users.id, set: user });
    } catch (error) {
      // Two admins created with the same username at once: the unique index decides.
      if (isUniqueViolation(error, "users_username_unique")) {
        throw new ConflictError(`Ya existe un admin "${user.username}"`, "username");
      }
      throw error;
    }
  }
}
