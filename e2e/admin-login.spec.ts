import { expect, test } from "@playwright/test";

const email = process.env.SEED_DARO_EMAIL ?? "";
const password = process.env.SEED_DARO_PASSWORD ?? "";

test.describe("admin access", () => {
  test.beforeAll(() => {
    if (!email || !password) throw new Error("SEED_DARO_EMAIL and SEED_DARO_PASSWORD are required");
  });

  for (const path of ["/admin", "/admin/galeria"]) {
    test(`redirects ${path} to /login without a session`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login(\?|$)/);
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    });
  }

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("definitely-wrong");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("a seeded admin signs in, sees the panel and signs out", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Panel" });
    for (const item of ["Resumen", "Subir", "Galería", "Página", "Links"]) {
      await expect(nav.getByRole("link", { name: item })).toBeVisible();
    }

    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
