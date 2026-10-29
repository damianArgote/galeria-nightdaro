import type { AdminIdentity } from "@/core/users/user";

export class UnauthorizedError extends Error {
  constructor() {
    super("Admin session required");
    this.name = "UnauthorizedError";
  }
}

type SessionLike = { user?: { id?: string | null; email?: string | null } | null } | null;

export function createRequireAdmin(getSession: () => Promise<SessionLike>) {
  return async function requireAdmin(): Promise<AdminIdentity> {
    const session = await getSession();
    const id = session?.user?.id;
    const email = session?.user?.email;
    if (!id || !email) throw new UnauthorizedError();
    return { id, email };
  };
}
