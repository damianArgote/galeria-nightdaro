import type { NextAuthConfig } from "next-auth";

/** Edge-safe part of the Auth.js config, shared by middleware.ts and auth.ts. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    // Returns the redirect itself: with a custom middleware handler (src/middleware.ts),
    // next-auth runs the handler instead of its default sign-in redirect when this is false.
    authorized({ auth, request }) {
      if (!request.nextUrl.pathname.startsWith("/admin") || auth?.user) return true;
      const signIn = new URL("/login", request.nextUrl);
      signIn.searchParams.set("callbackUrl", request.nextUrl.href);
      return Response.redirect(signIn);
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
