"use server";

import { cookies } from "next/headers";
import { AGE_COOKIE, AGE_COOKIE_MAX_AGE } from "./routing";

/** The visitor confirmed they are 18 or older: remember it for a year. */
export async function acceptAgeGate() {
  (await cookies()).set(AGE_COOKIE, "1", {
    maxAge: AGE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    // Secure wherever the site is served over HTTPS (production); plain http in local dev.
    secure: process.env.SITE_URL?.startsWith("https://") ?? false,
  });
}
