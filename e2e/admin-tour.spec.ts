import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";

test.describe("panel tutorials", () => {
  test.use({ storageState: ADMIN_STATE });

  test("«Ver tutorial» walks through the section and closes with Listo", async ({ page }) => {
    await page.goto("/admin/subir");
    await page.getByRole("button", { name: "Ver tutorial" }).click();

    const popover = page.locator(".driver-popover");
    await expect(popover).toContainText("Qué vas a subir");
    await expect(popover).toContainText("1 de 5");
    for (let step = 1; step < 5; step++) {
      await popover.getByRole("button", { name: "Siguiente" }).click();
    }
    await expect(popover).toContainText("Queda como borrador");
    await popover.getByRole("button", { name: "Listo" }).click();
    await expect(popover).toHaveCount(0);
  });

  test("every section of the panel has a tutorial whose steps are on screen", async ({ page }) => {
    for (const path of [
      "/admin",
      "/admin/subir",
      "/admin/galeria",
      "/admin/pagina",
      "/admin/links",
      "/admin/usuarios",
    ]) {
      await page.goto(path);
      await page.getByRole("button", { name: "Ver tutorial" }).click();
      const popover = page.locator(".driver-popover");
      await expect(popover, path).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(popover, path).toHaveCount(0);
    }
  });

  test("starts by itself on the first visit of a section, once per admin", async ({ context }) => {
    // Browsers under automation do not get it by themselves; this one pretends not to be.
    await context.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }),
    );
    const page = await context.newPage();
    await page.goto("/admin/pagina");
    const popover = page.locator(".driver-popover");
    await expect(popover).toContainText("Nombre y presentación");
    await page.keyboard.press("Escape");

    await page.reload();
    await page.waitForTimeout(800);
    await expect(popover).toHaveCount(0);
  });
});
