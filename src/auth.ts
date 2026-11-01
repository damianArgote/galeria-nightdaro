import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { authConfig } from "@/auth.config";
import type { AdminIdentity } from "@/core/users/user";
import { clientIp } from "@/infra/auth/client-ip";
import {
  createRequireAdmin,
  MustChangePasswordError,
  UnauthorizedError,
  type RequireAdminOptions,
} from "@/infra/auth/require-admin";
import { container } from "@/infra/container";

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(credentials, request) {
        if (!container.loginRateLimiter.consume(clientIp(request.headers))) {
          throw new RateLimitedSignin();
        }
        // Validated with Zod inside the use case: anything else than two bounded strings fails.
        return container.authenticateAdmin.execute({
          username: credentials.username,
          password: credentials.password,
        });
      },
    }),
  ],
});

/**
 * First call of every admin Server Action and API route: throws UnauthorizedError when there
 * is no valid session (also a disabled admin or ended sessions) and MustChangePasswordError
 * while the password is temporary.
 */
export const requireAdmin = createRequireAdmin(auth, (id) => container.findAdmin(id));

/** The same guard for pages: redirects to /login, or to /cambiar-clave with a temporary password. */
export async function requireAdminPage(options?: RequireAdminOptions): Promise<AdminIdentity> {
  try {
    return await requireAdmin(options);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    if (error instanceof MustChangePasswordError) redirect("/cambiar-clave");
    throw error;
  }
}
