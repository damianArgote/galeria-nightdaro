import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { clientIp } from "@/infra/auth/client-ip";
import { createRequireAdmin } from "@/infra/auth/require-admin";
import { container } from "@/infra/container";

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        if (!container.loginRateLimiter.consume(clientIp(request.headers))) {
          throw new RateLimitedSignin();
        }
        // Validated with Zod inside the use case: anything else than two bounded strings fails.
        return container.authenticateAdmin.execute({
          email: credentials.email,
          password: credentials.password,
        });
      },
    }),
  ],
});

/** First call of every admin Server Action: throws when there is no admin session. */
export const requireAdmin = createRequireAdmin(auth);
