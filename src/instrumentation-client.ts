import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry-options";

// NEXT_PUBLIC_SENTRY_DSN is copied from SENTRY_DSN at build time (next.config.ts).
Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
