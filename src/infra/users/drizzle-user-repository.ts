import { asc, eq } from "drizzle-orm";
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

  async save(user: AdminUser): Promise<void> {
    await this.db.insert(users).values(user).onConflictDoUpdate({ target: users.id, set: user });
  }
}
