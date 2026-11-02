import { expect, test, type Page } from "@playwright/test";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { ADMIN_STATE, e2eDatabaseUrl } from "../playwright.config";

async function tierClicks(page: Page, tier: string) {
  await page.goto("/admin?desde=2020-01-01&hasta=2099-12-31");
  const row = page.getByTestId("clicks-by-tier").getByRole("listitem").filter({ hasText: tier });
  return (await row.count()) === 0 ? 0 : Number(await row.locator("b").innerText());
}

async function stat(page: Page, label: string) {
  return Number((await page.getByTestId(`stat-${label}`).innerText()).replace(/\D/g, ""));
}

test.describe("metrics", () => {
  test("browsing the gallery and clicking a tier shows up in the Resumen", async ({ browser }) => {
    const admin = await browser.newPage({ storageState: ADMIN_STATE });
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date());
    await admin.goto(`/admin?desde=${today}&hasta=${today}`);
    const visitsBefore = await stat(admin, "Visitas");
    const clicksBefore = await tierClicks(admin, "Tier 3");

    const visitor = await browser.newPage();
    await visitor.route("https://www.patreon.com/**", (route) =>
      route.fulfill({ body: "<title>Patreon</title>", contentType: "text/html" }),
    );
    await visitor.goto("/");
    await visitor.getByRole("button", { name: "Tengo 18 o más, entrar" }).click();
    await visitor
      .getByTestId("gallery-card")
      .filter({ hasText: "Calabaza Pin-up" })
      .getByRole("button")
      .click();
    await visitor.getByRole("link", { name: "Ver completa en Patreon" }).click();
    await expect(visitor).toHaveURL(/\/apoyar$/);
    await visitor.getByRole("link", { name: "Unirme como Tier 3" }).click();
    await expect(visitor).toHaveURL("https://www.patreon.com/cw/Ndaro");
    await visitor.close();

    await expect.poll(() => tierClicks(admin, "Tier 3")).toBe(clicksBefore + 1);
    await admin.goto(`/admin?desde=${today}&hasta=${today}`);
    expect(await stat(admin, "Visitas")).toBeGreaterThanOrEqual(visitsBefore + 2);
    await expect(admin.getByTestId("top-artworks")).toContainText("Calabaza Pin-up");
    await expect(admin.getByTestId("chart-visits")).toBeVisible();
    await admin.close();
  });

  test("never stores the visitor's IP", async ({ request }) => {
    const ip = "203.0.113.99";
    const headers = { "x-forwarded-for": ip, "user-agent": "Mozilla/5.0 Chrome/130 metrics-test" };
    expect(
      (
        await request.post("/api/events", {
          headers,
          data: { type: "view", referrer: `http://${ip}/x` },
        })
      ).status(),
    ).toBe(204);
    expect(
      (await request.post("/api/events", { headers, data: { type: "age_ok" } })).status(),
    ).toBe(204);
    expect((await request.get("/r/patreon-2", { headers, maxRedirects: 0 })).status()).toBe(302);

    const { db, close } = createDb(e2eDatabaseUrl());
    try {
      const rows = await db.execute<{ row: string }>(
        sql`select row_to_json(e)::text as row from events e`,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const { row } of rows) expect(row).not.toContain(ip);
    } finally {
      await close();
    }
  });

  test("/api/events ignores crawlers and rejects bad, foreign or excessive requests", async ({
    request,
  }) => {
    const browser = {
      "user-agent": "Mozilla/5.0 Chrome/130 rate-test",
      "x-forwarded-for": "198.51.100.77",
    };

    expect(
      (
        await request.post("/api/events", {
          headers: { "user-agent": "Googlebot/2.1" },
          data: { type: "view" },
        })
      ).status(),
    ).toBe(204);
    expect(
      (await request.post("/api/events", { headers: browser, data: { type: "click" } })).status(),
    ).toBe(400);
    expect(
      (
        await request.post("/api/events", {
          headers: { ...browser, origin: "https://evil.example" },
          data: { type: "view" },
        })
      ).status(),
    ).toBe(403);

    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      statuses.push(
        (await request.post("/api/events", { headers: browser, data: { type: "view" } })).status(),
      );
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
