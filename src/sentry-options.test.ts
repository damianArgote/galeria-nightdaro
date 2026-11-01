import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry-options";

describe("sentryOptions", () => {
  it("is off without a DSN and never sends PII or replays", () => {
    expect(sentryOptions(undefined)).toMatchObject({ enabled: false, sendDefaultPii: false });
    expect(sentryOptions("https://key@o1.ingest.sentry.io/1")).toMatchObject({ enabled: true });
    expect(sentryOptions("x")).not.toHaveProperty("replaysSessionSampleRate");
    // Errors only: transactions would carry request headers that beforeSend does not see.
    expect(sentryOptions("x")).toMatchObject({ tracesSampleRate: 0 });
  });

  it("strips IP, cookie and session headers and the user's details before sending", () => {
    const event = {
      request: {
        headers: {
          "x-forwarded-for": "203.0.113.7",
          "cf-connecting-ip": "203.0.113.7",
          cookie: "authjs.session-token=secret",
          "user-agent": "Mozilla/5.0",
        },
        cookies: { "authjs.session-token": "secret" },
      },
      user: { id: "u1", email: "daro@example.com", ip_address: "203.0.113.7" },
    } as unknown as ErrorEvent;

    const sent = sentryOptions("x").beforeSend(event);

    expect(sent.request?.headers).toEqual({ "user-agent": "Mozilla/5.0" });
    expect(sent.request?.cookies).toBeUndefined();
    expect(sent.user).toEqual({ id: "u1" });
    expect(JSON.stringify(sent)).not.toMatch(/203\.0\.113\.7|secret|daro@/);
  });
});
