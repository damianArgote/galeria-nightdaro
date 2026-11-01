import "server-only";
import { PATREON_CALLBACK_PATH } from "@/infra/patreon/patreon-config";

/** Holds the OAuth state between /api/admin/patreon/connect and the callback (CSRF). */
export const PATREON_STATE_COOKIE = "patreon_oauth_state";

export const patreonStateCookieOptions = {
  httpOnly: true,
  // Lax: the cookie comes back on Patreon's top-level redirect to the callback.
  sameSite: "lax" as const,
  secure: process.env.SITE_URL?.startsWith("https://") ?? false,
  path: PATREON_CALLBACK_PATH,
  maxAge: 10 * 60,
};
