import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";

const TITLE = "Demonio de gafas (busto)";
const POST = "https://www.patreon.com/posts/demonio-de-gafas-123456";

test.describe("artwork linked to its Patreon post", () => {
  test.use({ storageState: ADMIN_STATE });

  test("the button leads to the post through /r/obra and the Resumen counts which artwork sent the visitor", async ({
    page,
    browser,
  }) => {
    await page.goto("/admin/galeria");
    const row = page.getByTestId("artwork-row").filter({ hasText: TITLE });
    await row.getByRole("button", { name: "Editar" }).click();
    const post = page.getByLabel("Post de Patreon");
    await post.fill("https://evil.example/posts/1");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Pegá el link del post en patreon.com")).toBeVisible();
    await post.fill(POST);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(post).toHaveCount(0);

    // Visitors past the age gate (its modal would cover the gallery).
    const pastGate = {
      cookies: [
        {
          name: "age_ok",
          value: "1",
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax" as const,
        },
      ],
      origins: [],
    };
    const visitor = await browser.newContext({ storageState: pastGate });
    const publicPage = await visitor.newPage();
    await publicPage.route("https://www.patreon.com/**", (route) =>
      route.fulfill({ body: "<title>Patreon</title>", contentType: "text/html" }),
    );
    await publicPage.goto("/");
    await publicPage
      .getByTestId("gallery-card")
      .filter({ hasText: TITLE })
      .getByRole("button")
      .click();
    const button = publicPage.getByRole("link", { name: "See it in full on Patreon" });
    await expect(button).toHaveAttribute("href", /^\/r\/obra\/[0-9a-f-]{36}$/);
    await button.click();
    await expect(publicPage).toHaveURL(POST);
    await visitor.close();

    await page.goto("/admin");
    await expect(page.getByTestId("artwork-clicks")).toContainText(TITLE);

    // Without a post the button goes to /apoyar again.
    await page.goto("/admin/galeria");
    const again = page.getByTestId("artwork-row").filter({ hasText: TITLE });
    await again.getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Post de Patreon").fill("");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByLabel("Post de Patreon")).toHaveCount(0);

    const second = await browser.newContext({ storageState: pastGate });
    const secondPage = await second.newPage();
    await secondPage.goto("/");
    await secondPage
      .getByTestId("gallery-card")
      .filter({ hasText: TITLE })
      .getByRole("button")
      .click();
    await expect(
      secondPage.getByRole("link", { name: "See it in full on Patreon" }),
    ).toHaveAttribute("href", "/apoyar");
    await second.close();
  });

  test("/r/obra rejects unknown or malformed ids", async ({ request }) => {
    for (const id of ["00000000-0000-4000-8000-000000000000", "nope"]) {
      expect((await request.get(`/r/obra/${id}`, { maxRedirects: 0 })).status()).toBe(404);
    }
  });
});
