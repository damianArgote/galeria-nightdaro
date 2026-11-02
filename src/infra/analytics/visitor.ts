import { createHmac } from "node:crypto";
import type { VisitorContext } from "@/core/analytics/analytics-event";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/core/gallery/locale";
import { clientIp } from "../auth/client-ip";

const DEV_SALT = "local-dev-analytics-salt";

/** Secret salt of the session hash. Required in production so hashes cannot be recomputed. */
export function analyticsSalt(): string {
  const salt = process.env.ANALYTICS_SALT;
  if (salt) return salt;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ANALYTICS_SALT must be set in production");
  }
  return DEV_SALT;
}

/**
 * Daily session hash: HMAC-SHA256(salt, UTC day + IP + user agent). It changes every day and
 * cannot be reversed or recomputed without the salt; the IP is never stored or returned.
 */
export function sessionHash(input: {
  ip: string;
  userAgent: string;
  salt: string;
  now?: Date;
}): string {
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  return createHmac("sha256", input.salt)
    .update(`${day}\n${input.ip}\n${input.userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

/** Gallery language from the lang cookie (the same one the rewrites read); English otherwise. */
function localeFrom(headers: Headers): Locale {
  const value = headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("lang="))
    ?.slice("lang=".length)
    .trim();
  // Decoded like Next's cookie parser, so the stat matches the page the rewrites served.
  let decoded = value;
  try {
    decoded = value && decodeURIComponent(value);
  } catch {
    // Malformed escape: not a locale either.
  }
  return decoded && isLocale(decoded) ? decoded : DEFAULT_LOCALE;
}

/** Turns request headers into a visitor without keeping the IP. */
export function visitorFrom(headers: Headers, now?: Date): VisitorContext {
  const country = headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country");
  return {
    sessionHash: sessionHash({
      ip: clientIp(headers),
      userAgent: headers.get("user-agent") ?? "",
      salt: analyticsSalt(),
      now,
    }),
    country: country?.toUpperCase() ?? null,
    locale: localeFrom(headers),
  };
}
