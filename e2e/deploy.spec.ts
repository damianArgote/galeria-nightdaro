import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";

test.describe("deploy endpoints", () => {
  test("the health check answers without touching the database; ?db=1 checks it", async ({
    request,
  }) => {
    const live = await request.get("/api/health");
    expect(live.status()).toBe(200);
    expect(await live.json()).toEqual({ status: "ok" });
    expect(live.headers()["cache-control"]).toBe("no-store");

    const deep = await request.get("/api/health?db=1");
    expect(deep.status()).toBe(200);
    expect(await deep.json()).toEqual({ status: "ok", database: "ok" });
  });

  test("the IP diagnostic is admin only and shows the headers it receives", async ({ browser }) => {
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    expect((await anonymous.request.get("/api/admin/ip-check")).status()).toBe(401);
    await anonymous.close();

    const admin = await browser.newContext({ storageState: ADMIN_STATE });
    const response = await admin.request.get("/api/admin/ip-check", {
      headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.50", "cf-connecting-ip": "203.0.113.50" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.headers).toMatchObject({ "cf-connecting-ip": "203.0.113.50" });
    expect(body.resolved).toBe("203.0.113.50");
    await admin.close();
  });
});
