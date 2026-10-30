export const AGE_COOKIE = "age_ok";
export const AGE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Public gallery paths and the path each one maps to inside /g/[audience]. */
export const GALLERY_ROUTES = [
  { source: "/", target: "/inicio" },
  { source: "/en-proceso", target: "/en-proceso" },
  { source: "/timelapses", target: "/timelapses" },
  { source: "/apoyar", target: "/apoyar" },
  { source: "/obra/:slug([a-z0-9-]+)", target: "/obra/:slug" },
] as const;

/**
 * Crawlers and link previews only ever get the sfw variant, even with an age_ok cookie.
 * Written case by case (no `i` flag) because next.config rewrite conditions take a plain pattern.
 */
export const CRAWLER_PATTERN =
  ".*([Bb]ot|BOT|[Cc]rawl|[Ss]pider|[Ss]lurp|[Pp]review|facebookexternalhit|[Ee]mbedly|WhatsApp|[Tt]elegram|[Dd]iscord|[Ss]kype|vkShare|[Pp]interest|[Ii]nspection[Tt]ool).*";

const crawler = new RegExp(`^${CRAWLER_PATTERN}$`);

export function isCrawler(userAgent: string | null): boolean {
  return !userAgent || crawler.test(userAgent);
}

type Rewrite = {
  source: string;
  destination: string;
  has?: { type: "header" | "cookie"; key: string; value?: string }[];
  missing?: { type: "header" | "cookie"; key: string; value?: string }[];
};

/**
 * Picks the static variant of each gallery page, in order: crawlers (or no user agent) → sfw,
 * age_ok=1 → adult, anyone else → sfw. Done with config rewrites, not middleware: a middleware
 * rewrite turns off the ISR cache of the target page.
 */
export function galleryRewrites(): Rewrite[] {
  return GALLERY_ROUTES.flatMap(({ source, target }) => [
    {
      source,
      destination: `/g/sfw${target}`,
      has: [{ type: "header", key: "user-agent", value: CRAWLER_PATTERN }],
    },
    { source, destination: `/g/sfw${target}`, missing: [{ type: "header", key: "user-agent" }] },
    {
      source,
      destination: `/g/adult${target}`,
      has: [{ type: "cookie", key: AGE_COOKIE, value: "1" }],
    },
    { source, destination: `/g/sfw${target}` },
  ]);
}
