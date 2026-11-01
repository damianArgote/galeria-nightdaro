import { toIdentity, type AdminIdentity, type AdminRole, type AdminUser } from "@/core/users/user";

export class UnauthorizedError extends Error {
  constructor() {
    super("Admin session required");
    this.name = "UnauthorizedError";
  }
}

/** The admin must pick their own password before using the panel. */
export class MustChangePasswordError extends Error {
  constructor() {
    super("Password change required");
    this.name = "MustChangePasswordError";
  }
}

type SessionLike = {
  user?: { id?: string | null; sessionVersion?: number | null } | null;
} | null;

export interface RequireAdminOptions {
  /** Only the owner (user management). */
  role?: AdminRole;
  /** The change-password screen and action, the only ones open with a temporary password. */
  allowTemporaryPassword?: boolean;
}

/**
 * The real guard of the panel. The session token alone is not enough: the admin is read from
 * the database on every call, so disabling them or bumping their session version (password
 * reset or change) ends a token that is otherwise still valid.
 */
export function createRequireAdmin(
  getSession: () => Promise<SessionLike>,
  loadUser: (id: string) => Promise<AdminUser | null>,
) {
  return async function requireAdmin(options: RequireAdminOptions = {}): Promise<AdminIdentity> {
    const session = await getSession();
    const id = session?.user?.id;
    const version = session?.user?.sessionVersion;
    if (!id || typeof version !== "number") throw new UnauthorizedError();

    const user = await loadUser(id);
    if (!user || user.disabledAt || user.sessionVersion !== version) {
      throw new UnauthorizedError();
    }
    if (options.role && user.role !== options.role) throw new UnauthorizedError();
    if (user.mustChangePassword && !options.allowTemporaryPassword) {
      throw new MustChangePasswordError();
    }
    return toIdentity(user);
  };
}
