/**
 * The site's public origin. Behind Render's proxy, `request.url` carries the internal address
 * (http://localhost:10000), so links and same-origin checks use SITE_URL instead; without it
 * (local dev, tests) the request's own origin is right.
 */
function siteOrigin(request: Request): string {
  const configured = process.env.SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // A malformed SITE_URL falls back to the request, like an unset one.
    }
  }
  return new URL(request.url).origin;
}

/** An absolute URL on the public site, for redirects. */
export function publicUrl(path: string, request: Request): URL {
  return new URL(path, siteOrigin(request));
}

/** True when a browser's Origin header is this site (scheme, host and port). */
export function isSameSiteOrigin(origin: string, request: Request): boolean {
  try {
    return new URL(origin).origin === siteOrigin(request);
  } catch {
    return false;
  }
}
