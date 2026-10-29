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
        const email = typeof credentials.email === "string" ? credentials.email : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";
        return container.authenticateAdmin.execute({ email, password });
      },
    }),
  ],
});

/** First call of every admin Server Action: throws when there is no admin session. */
export const requireAdmin = createRequireAdmin(auth);
