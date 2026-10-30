import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { AGE_COOKIE, galleryRewrite, isCrawler } from "@/app/g/routing";

const { auth } = NextAuth(authConfig);

/**
 * /admin: no session, no entry (authConfig.callbacks.authorized redirects to /login).
 * Public gallery: each page has two static variants, /g/sfw/… and /g/adult/…; this picks one
 * from the age_ok cookie (crawlers always get sfw). /g/* cannot be requested directly.
 */
export default auth((request: NextRequest) => {
  const { pathname } = request.nextUrl;
  if (pathname === "/g" || pathname.startsWith("/g/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const target = galleryRewrite(pathname);
  if (!target) return NextResponse.next();

  const accepted = request.cookies.get(AGE_COOKIE)?.value === "1";
  const audience = accepted && !isCrawler(request.headers.get("user-agent")) ? "adult" : "sfw";
  const url = request.nextUrl.clone();
  url.pathname = `/g/${audience}${target}`;
  return NextResponse.rewrite(url);
});

export const config = {
  matcher: [
    "/",
    "/en-proceso",
    "/timelapses",
    "/apoyar",
    "/obra/:slug*",
    "/g",
    "/g/:path*",
    "/admin/:path*",
  ],
};
