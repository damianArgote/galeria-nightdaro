import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * /admin: no session, no entry (authConfig.callbacks.authorized redirects to /login).
 * /g/*: the gallery variants are only reachable through the rewrites in next.config.ts, which
 * run after this middleware, so a direct request never gets to choose the adult variant.
 */
export default auth((request: NextRequest) => {
  const { pathname } = request.nextUrl;
  if (pathname === "/g" || pathname.startsWith("/g/")) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/g", "/g/:path*", "/admin/:path*"],
};
