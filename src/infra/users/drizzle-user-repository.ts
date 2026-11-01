import { and, asc, eq, isNull } from "drizzle-orm";
import type { AdminUser } from "@/core/users/user";
import type { UserRepository } from "@/core/users/user-repository";
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
    await this.db.insert(users).values(user).onConflictDoUpdate({ target: users.id, set: user });
  }
}
