import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const prod = {
  cdnHost: "nightdaro-public.b-cdn.net",
  sentryDsn: "https://abc123@o42.ingest.us.sentry.io/7",
  https: true,
  development: false,
};

function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe("contentSecurityPolicy", () => {
  it("only allows the site, the Bunny CDN, the Stream player and the Sentry ingest host", () => {
    const csp = directives(contentSecurityPolicy(prod));
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["img-src"]).toEqual([
      "'self'",
      "data:",
      "blob:",
      "https://nightdaro-public.b-cdn.net",
    ]);
    // The timelapse iframe loads /media/{id}/player first (same origin), which redirects to Bunny.
    expect(csp["frame-src"]).toEqual(["'self'", "https://iframe.mediadelivery.net"]);
    expect(csp["connect-src"]).toEqual([
      "'self'",
      "https://video.bunnycdn.com",
      "https://o42.ingest.us.sentry.io",
    ]);
    expect(csp["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it("blocks plugins, framing, foreign forms and base URL changes", () => {
    const csp = directives(contentSecurityPolicy(prod));
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["upgrade-insecure-requests"]).toEqual([]);
  });

  it("drops the CDN and Sentry when they are not configured (local dev)", () => {
    const csp = directives(contentSecurityPolicy({ https: false, development: true }));
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:"]);
    expect(csp["connect-src"]).toEqual(["'self'", "https://video.bunnycdn.com"]);
    // React needs eval in development for its debugging tools; never in production.
    expect(csp["script-src"]).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'"]);
    expect(csp["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("does not upgrade requests on a production build served over http (e2e)", () => {
    const csp = directives(contentSecurityPolicy({ https: false, development: false }));
    expect(csp["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("ignores a malformed DSN or CDN host instead of widening the policy", () => {
    const csp = directives(
      contentSecurityPolicy({ ...prod, cdnHost: "evil.com https:", sentryDsn: "not a url" }),
    );
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:"]);
    expect(csp["connect-src"]).toEqual(["'self'", "https://video.bunnycdn.com"]);
  });
});

describe("securityHeaders", () => {
  it("sends the hardening headers, HSTS only over HTTPS", () => {
    const names = (https: boolean) =>
      Object.fromEntries(
        securityHeaders({ https, development: false }).map((h) => [h.key, h.value]),
      );

    const headers = names(true);
    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      // Bunny checks the Referer of CDN and player requests against the allowed domains.
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    });
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(names(false)["Strict-Transport-Security"]).toBeUndefined();
  });
});
