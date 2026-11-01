import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";

/** Collects what the browser blocked because of the Content-Security-Policy. */
function cspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
      violations.push(`${page.url()}: ${message.text()}`);
    }
  });
  return violations;
}

/**
 * Waits until every image settled. Not "networkidle" or "load": the Stream player iframe of the
 * demo timelapses never finishes loading offline, and CSP blocks are reported right away anyway.
 */
async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}

const PUBLIC_PAGES = ["/", "/timelapses", "/en-proceso", "/apoyar", "/login"];
const ADMIN_PAGES = ["/admin", "/admin/subir", "/admin/galeria", "/admin/pagina", "/admin/links"];

test.describe("security headers", () => {
  test("every response carries the CSP and the hardening headers", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("the public gallery renders without CSP violations", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const violations = cspViolations(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Tengo 18 o más, entrar" }).click();
    await expect(page.getByRole("dialog", { name: /Contenido para adultos/ })).toHaveCount(0);
    for (const path of PUBLIC_PAGES) {
      await page.goto(path, { waitUntil: "commit" });
      await settle(page);
    }
    expect(violations).toEqual([]);

    // The timelapse lightbox frames /media/{id}/player, a same-origin route that redirects to
    // Bunny. The demo data has no Stream video, so the frame is added by hand and only frame-src
    // matters here (without a video the route lands on a page that refuses to be framed).
    await page.evaluate(() => {
      const frame = document.createElement("iframe");
      frame.src = "/media/00000000-0000-4000-8000-000000000000/player";
      document.body.append(frame);
    });
    await page.waitForTimeout(500);
    expect(violations.filter((v) => v.includes("frame-src"))).toEqual([]);
    await context.close();
  });

  test("the panel renders without CSP violations", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    const violations = cspViolations(page);

    for (const path of ADMIN_PAGES) {
      await page.goto(path, { waitUntil: "commit" });
      await settle(page);
    }

    expect(violations).toEqual([]);
    await context.close();
  });
});
