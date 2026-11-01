/**
 * Security headers for every response (next.config.ts). The CSP is static on purpose: a nonce
 * would force every page to render per request and the public gallery would lose ISR, so
 * scripts allow 'unsafe-inline' and every other directive stays closed.
 */
export interface SecurityHeadersOptions {
  /** Pull Zone of public-media (BUNNY_CDN_HOST), where /media/… redirects the images. */
  cdnHost?: string;
  /** SENTRY_DSN: the browser SDK posts errors to its ingest host. */
  sentryDsn?: string;
  /** The site is served over HTTPS (SITE_URL): upgrade subresources and send HSTS. */
  https: boolean;
  /** `next dev`: React's dev tooling needs eval. */
  development: boolean;
}

/** Bunny Stream: the embed player and the TUS upload endpoint used by /admin/subir. */
const STREAM_PLAYER = "https://iframe.mediadelivery.net";
const STREAM_UPLOAD = "https://video.bunnycdn.com";

const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** A misconfigured value must never widen the policy, so anything odd is left out. */
function cdnOrigin(host: string | undefined): string | null {
  return host && HOSTNAME.test(host) ? `https://${host}` : null;
}

function sentryOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    return url.protocol === "https:" && HOSTNAME.test(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({
  cdnHost,
  sentryDsn,
  https,
  development,
}: SecurityHeadersOptions): string {
  const cdn = cdnOrigin(cdnHost);
  const sentry = sentryOrigin(sentryDsn);
  const directives: [string, ...(string | null | false)[]][] = [
    ["default-src", "'self'"],
    ["script-src", "'self'", "'unsafe-inline'", development && "'unsafe-eval'"],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:", cdn],
    ["font-src", "'self'", "data:"],
    ["connect-src", "'self'", STREAM_UPLOAD, sentry],
    // 'self': the timelapse iframe loads /media/{id}/player, which signs and redirects to Bunny.
    ["frame-src", "'self'", STREAM_PLAYER],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  if (https) directives.push(["upgrade-insecure-requests"]);
  return directives
    .map(([name, ...values]) => [name, ...values.filter(Boolean)].join(" "))
    .join("; ");
}

export function securityHeaders(options: SecurityHeadersOptions): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    // Sends only the origin to other sites: Bunny checks it against the allowed referrers.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ];
  if (options.https) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }
  return headers;
}
