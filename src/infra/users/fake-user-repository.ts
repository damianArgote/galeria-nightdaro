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
  async save(user: AdminUser) {
    const taken = [...this.items.values()].find(
      (u) => u.username === user.username && u.id !== user.id,
    );
    if (taken) throw new Error(`Duplicate username: ${user.username}`);
    this.items.set(user.id, structuredClone(user));
  }
}
