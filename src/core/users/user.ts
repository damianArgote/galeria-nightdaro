export const ADMIN_ROLES = ["owner", "admin"] as const;
/** The owner manages the other admins; an admin uses the panel. */
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Lowercase letters, digits, dot, dash and underscore; 3 to 32 characters. */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export interface AdminUser {
  id: string;
  username: string;
  /** Only admins created before usernames have one; they may still log in with it. */
  email: string | null;
  passwordHash: string;
  role: AdminRole;
  /** Set for a temporary password: the panel stays locked until the admin picks their own. */
  mustChangePassword: boolean;
  disabledAt: Date | null;
  /**
   * Stored in every session token and checked on every request: bumping it (disable, reset,
   * password change) ends the admin's sessions at once.
   */
  sessionVersion: number;
}

/** What the session exposes about the signed-in admin; never the password hash. */
export interface AdminIdentity {
  id: string;
  username: string;
  role: AdminRole;
  mustChangePassword: boolean;
  sessionVersion: number;
}

export const toIdentity = (user: AdminUser): AdminIdentity => ({
  id: user.id,
  username: user.username,
  role: user.role,
  mustChangePassword: user.mustChangePassword,
  sessionVersion: user.sessionVersion,
});

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Same rule as migration 0006: the part before "@", cleaned, at least 3 characters. */
export function usernameFromEmail(email: string): string {
  const clean = normalizeEmail(email)
    .split("@")[0]!
    .replace(/[^a-z0-9._-]/g, "");
  return (clean.length < 3 ? `${clean}-admin` : clean).slice(0, 28);
}
