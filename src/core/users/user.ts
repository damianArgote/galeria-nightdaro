export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
}

/** What the session exposes about the signed-in admin; never the password hash. */
export interface AdminIdentity {
  id: string;
  email: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
