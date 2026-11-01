import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./src/sentry-options";

Sentry.init(sentryOptions(process.env.SENTRY_DSN));
