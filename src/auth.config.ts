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
      // Relative: behind Render's proxy the absolute URL is the internal address.
      signIn.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
      return Response.redirect(signIn);
    },
    // The token carries the session version; requireAdmin compares it with the database.
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.name = user.username;
        token.sv = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.name = token.name ?? null;
      session.user.sessionVersion = typeof token.sv === "number" ? token.sv : undefined;
      return session;
    },
  },
} satisfies NextAuthConfig;
