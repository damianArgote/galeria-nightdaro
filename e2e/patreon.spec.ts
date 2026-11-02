import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { DrizzlePatreonConnectionRepository } from "@/infra/patreon/drizzle-patreon-connection-repository";
import { TokenCipher } from "@/infra/patreon/token-cipher";
import { ADMIN_STATE, e2eDatabaseUrl } from "../playwright.config";

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

test.describe("Patreon webhook", () => {
  const SECRET = "e2e-webhook-secret";
  const sign = (body: string) => createHmac("md5", SECRET).update(body).digest("hex");
  const pledge = (memberId: string) =>
    JSON.stringify({
      data: {
        id: memberId,
        type: "member",
        attributes: {
          patron_status: "active_patron",
          currently_entitled_amount_cents: 500,
          pledge_relationship_start: "2026-11-01T10:00:00.000+00:00",
          full_name: "A Fan",
          email: "fan@example.com",
        },
        relationships: { currently_entitled_tiers: { data: [{ id: "pt-5", type: "tier" }] } },
      },
    });

  let db: ReturnType<typeof createDb>;
  let connections: DrizzlePatreonConnectionRepository;

  test.beforeAll(async () => {
    db = createDb(e2eDatabaseUrl());
    // Sealed with the same PATREON_TOKEN_KEY the e2e server runs with.
    connections = new DrizzlePatreonConnectionRepository(
      db.db,
      new TokenCipher("e2e-only-patreon-token-key"),
    );
    await connections.save({
      campaignId: "camp-1",
      campaignUrl: "https://www.patreon.com/cw/Ndaro",
      tokens: { accessToken: "a", refreshToken: "r", expiresAt: new Date(Date.now() + 86_400_000) },
      webhook: { id: "wh-1", secret: SECRET },
      connectedAt: new Date(),
    });
  });

  test.afterAll(async () => {
    await connections.delete();
    await db.db.execute(
      sql`delete from patreon_events; delete from patreon_members; delete from patreon_tiers`,
    );
    await db.close();
  });

  test("records a signed pledge once, keeps no name or email, and rejects bad signatures", async ({
    request,
  }) => {
    const body = pledge("e2e-member");
    const post = (signature: string, event = "members:pledge:create") =>
      request.post("/api/webhooks/patreon", {
        data: body,
        headers: {
          "content-type": "application/json",
          "x-patreon-event": event,
          "x-patreon-signature": signature,
        },
      });

    expect((await post(sign(body))).status()).toBe(204);
    // Patreon retries: the same delivery counts once.
    expect((await post(sign(body))).status()).toBe(204);
    expect((await post("0".repeat(32))).status()).toBe(401);
    expect((await post(sign(body), "members:pledge:launch")).status()).toBe(400);
    // posts:publish with a payload that is not a post.
    expect((await post(sign(body), "posts:publish")).status()).toBe(400);

    const events = await db.db.execute(
      sql`select kind, amount_cents from patreon_events where member_id = 'e2e-member'`,
    );
    expect([...events]).toEqual([{ kind: "alta", amount_cents: 500 }]);
    const members = await db.db.execute(sql`select * from patreon_members`);
    expect(JSON.stringify([...members])).not.toMatch(/Fan|fan@/);
  });

  test("the Resumen shows the pledge next to the clicks", async ({ browser }) => {
    await db.db.execute(
      sql`insert into patreon_tiers (id, title, amount_cents, position) values ('pt-5', 'Support', 500, 0)`,
    );
    const admin = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await admin.newPage();
    await page.goto("/admin");

    const section = page.getByTestId("patreon-summary");
    await expect(section.getByTestId("stat-Altas")).toHaveText("1");
    await expect(section.getByTestId("stat-Patrons activos")).toHaveText("1");
    await expect(section.getByTestId("stat-Ingreso mensual estimado")).toHaveText("US$5");
    await expect(section.getByTestId("patreon-by-tier").getByRole("row").nth(1)).toHaveText(
      /Support\s*sin vincular\s*1\s*1/,
    );
    await admin.close();
  });
});
