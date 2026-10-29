import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Redirects /admin requests without a session to /login (see authConfig.callbacks.authorized).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*"],
};
