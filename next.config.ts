import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { galleryRewrites } from "./src/app/g/routing";

const nextConfig: NextConfig = {
  // One variable (SENTRY_DSN) for server and browser; a DSN is public by design.
  env: { NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? "" },
  async rewrites() {
    // Before files, so the public gallery paths always resolve to /g/{sfw|adult}/….
    return { beforeFiles: galleryRewrites(), afterFiles: [], fallback: [] };
  },
};

// Source maps are uploaded only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
