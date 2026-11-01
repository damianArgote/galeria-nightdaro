import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";

test.describe("Patreon connection", () => {
  test.use({ storageState: ADMIN_STATE });

  test("the panel offers to connect, and connecting sends Daro to Patreon with a state cookie", async ({
    page,
    context,
  }) => {
    await page.goto("/admin/links");
    const panel = page.getByTestId("patreon-panel");
    await expect(panel.getByRole("link", { name: "Conectar Patreon" })).toBeVisible();

    const response = await page.request.get("/api/admin/patreon/connect", { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    const location = new URL(response.headers().location!);
    expect(location.origin + location.pathname).toBe("https://www.patreon.com/oauth2/authorize");
    expect(location.searchParams.get("client_id")).toBe("e2e-client-id");
    expect(location.searchParams.get("redirect_uri")).toMatch(/\/api\/patreon\/callback$/);
    expect(location.searchParams.get("scope")).toBe(
      "campaigns campaigns.members campaigns.posts w:campaigns.webhook",
    );

    const state = location.searchParams.get("state")!;
    const cookie = (await context.cookies()).find((c) => c.name === "patreon_oauth_state");
    expect(cookie).toMatchObject({ value: state, httpOnly: true, path: "/api/patreon/callback" });
  });

  test("the callback rejects a forged state and never stores a connection", async ({ page }) => {
    await page.request.get("/api/admin/patreon/connect", { maxRedirects: 0 });

    await page.goto("/api/patreon/callback?code=stolen-code&state=forged-state");
    await expect(page).toHaveURL(/\/admin\/links\?patreon=vencido$/);
    await expect(page.getByRole("status")).toContainText("La conexión venció");
    await expect(
      page.getByTestId("patreon-panel").getByRole("link", { name: "Conectar Patreon" }),
    ).toBeVisible();
  });

  test("a cancelled consent comes back as cancelled", async ({ page }) => {
    await page.goto("/api/patreon/callback?error=access_denied&state=x");
    await expect(page).toHaveURL(/\/admin\/links\?patreon=cancelado$/);
  });

  test("both OAuth routes are admin only", async ({ browser }) => {
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    for (const path of ["/api/admin/patreon/connect", "/api/patreon/callback?code=a&state=b"]) {
      const response = await anonymous.request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(401);
    }
    await anonymous.close();
  });
});
