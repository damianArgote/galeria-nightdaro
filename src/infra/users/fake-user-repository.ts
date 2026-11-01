import type { AdminUser } from "@/core/users/user";
import type { UserRepository } from "@/core/users/user-repository";

export class FakeUserRepository implements UserRepository {
  readonly items = new Map<string, AdminUser>();

  async findById(id: string) {
    const user = this.items.get(id);
    return user ? structuredClone(user) : null;
  }
  async findByUsername(username: string) {
    const user = [...this.items.values()].find((u) => u.username === username);
    return user ? structuredClone(user) : null;
  }
  async findByEmail(email: string) {
    const user = [...this.items.values()].find((u) => u.email === email);
    return user ? structuredClone(user) : null;
  }
  async list() {
    return [...this.items.values()].map((u) => structuredClone(u));
  }
  async setDisabled(id: string, disabledAt: Date | null) {
    const user = this.items.get(id);
    if (!user) return false;
    const otherActiveOwner = [...this.items.values()].some(
      (u) => u.role === "owner" && !u.disabledAt && u.id !== id,
    );
    if (disabledAt && user.role === "owner" && !otherActiveOwner) return false;
    this.items.set(id, { ...user, disabledAt, sessionVersion: user.sessionVersion + 1 });
    return true;
  }

  async resetPassword(id: string, passwordHash: string) {
    const user = this.items.get(id);
    if (!user) return false;
    this.items.set(id, {
      ...user,
      passwordHash,
      mustChangePassword: true,
      sessionVersion: user.sessionVersion + 1,
    });
    return true;
  }

  async updatePassword(
    id: string,
    expectedVersion: number,
    fields: Pick<AdminUser, "passwordHash" | "mustChangePassword" | "sessionVersion">,
  ) {
    const user = this.items.get(id);
    if (!user || user.sessionVersion !== expectedVersion || user.disabledAt) return false;
    this.items.set(id, { ...user, ...fields });
    return true;
  }

  async save(user: AdminUser) {
    const taken = [...this.items.values()].find(
      (u) => u.username === user.username && u.id !== user.id,
    );
    if (taken) throw new Error(`Duplicate username: ${user.username}`);
    this.items.set(user.id, structuredClone(user));
  }
}
