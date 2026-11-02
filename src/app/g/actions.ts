"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALES } from "@/core/gallery/locale";
import { AGE_COOKIE, AGE_COOKIE_MAX_AGE, LANG_COOKIE } from "./routing";

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

/**
 * The visitor picked the gallery language: remember it for a year. Validated here and not with
 * runAction, which would revalidate the whole site on every visitor's click.
 */
export async function setGalleryLocale(input: unknown) {
  const locale = z.enum(LOCALES).safeParse(input);
  if (!locale.success) return;
  (await cookies()).set(LANG_COOKIE, locale.data, {
    maxAge: AGE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.SITE_URL?.startsWith("https://") ?? false,
  });
}
