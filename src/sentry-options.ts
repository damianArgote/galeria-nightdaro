import type { ErrorEvent } from "@sentry/nextjs";

/** Headers that carry IPs or sessions: never sent to Sentry. */
const PRIVATE_HEADERS = [
  "cookie",
  "authorization",
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
];

/**
 * Options shared by the browser, server and edge SDKs. No PII (no IPs, cookies or users),
 * no Session Replay (it would record what visitors see, +18 art included) and a low trace rate.
 */
export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event: ErrorEvent) {
      if (event.request?.headers) {
        for (const header of PRIVATE_HEADERS) delete event.request.headers[header];
      }
      delete event.request?.cookies;
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  };
}
