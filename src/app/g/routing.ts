export const AGE_COOKIE = "age_ok";
export const AGE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Public path → path inside /g/[audience]; null when it is not a gallery page. */
export function galleryRewrite(pathname: string): string | null {
  if (pathname === "/") return "/inicio";
  if (["/en-proceso", "/timelapses", "/apoyar"].includes(pathname)) return pathname;
  if (/^\/obra\/[a-z0-9-]+$/.test(pathname)) return pathname;
  return null;
}

const CRAWLERS =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|skype|vkshare|pinterest|bingpreview|inspectiontool/i;

/** Crawlers and link previews only ever get the sfw variant, even with an age_ok cookie. */
export function isCrawler(userAgent: string | null): boolean {
  return !userAgent || CRAWLERS.test(userAgent);
}
