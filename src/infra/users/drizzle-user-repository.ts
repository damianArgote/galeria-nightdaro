import { eq } from "drizzle-orm";
import type { AdminUser } from "@/core/users/user";
import type { UserRepository } from "@/core/users/user-repository";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const [row] = await this.db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email));
    return row ?? null;
  }
}
