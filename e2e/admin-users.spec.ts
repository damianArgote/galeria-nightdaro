import { expect, test, type Browser, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { users } from "@/db/schema";
import { ADMIN_STATE, e2eDatabaseUrl } from "../playwright.config";

const USERNAME = "e2e-nueva";
const OWN_PASSWORD = "mi frase secreta larga";

async function logIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** A browser of its own, with its own client IP for the login rate limit. */
async function newAdminBrowser(browser: Browser, ip: string) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { "x-e2e-client-ip": ip },
  });
  return { context, page: await context.newPage() };
}

test.describe("admins managed by the owner", () => {
  test.use({ storageState: ADMIN_STATE });
  const db = createDb(e2eDatabaseUrl());

  test.beforeAll(async () => {
    await db.db.delete(users).where(eq(users.username, USERNAME));
  });
  test.afterAll(async () => {
    await db.db.delete(users).where(eq(users.username, USERNAME));
    await db.close();
  });

  test("the owner creates, disables, reactivates and resets an admin", async ({
    page,
    browser,
  }) => {
    await page.goto("/admin/usuarios");
    await page.getByLabel("Usuario del admin nuevo").fill("E2E-Nueva");
    await page.getByRole("button", { name: "Crear admin" }).click();
    const issued = page.getByTestId("temporary-password");
    await expect(issued).toContainText(USERNAME);
    const temporary = (await issued.locator("code").textContent())!;
    expect(temporary).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
    const row = page.getByTestId("admin-row").filter({ hasText: USERNAME });
    await expect(row).toContainText("Contraseña temporal");

    // The new admin picks a password and uses the panel, without the users section.
    const admin = await newAdminBrowser(browser, "198.51.100.21");
    await logIn(admin.page, USERNAME, temporary);
    await expect(admin.page).toHaveURL(/\/cambiar-clave$/);
    await admin.page.getByLabel("Contraseña temporal").fill(temporary);
    await admin.page.getByLabel("Contraseña nueva", { exact: true }).fill(OWN_PASSWORD);
    await admin.page.getByLabel("Repetí la contraseña nueva").fill(OWN_PASSWORD);
    await admin.page.getByRole("button", { name: "Guardar y volver a entrar" }).click();
    await expect(admin.page).toHaveURL(/\/login\?aviso=clave-cambiada$/);
    await logIn(admin.page, USERNAME, OWN_PASSWORD);
    await expect(admin.page).toHaveURL(/\/admin$/);
    await expect(
      admin.page.getByRole("navigation", { name: "Panel" }).getByRole("link", { name: "Usuarios" }),
    ).toHaveCount(0);
    expect((await admin.page.goto("/admin/usuarios"))?.status()).toBe(404);

    await page.reload();
    await expect(row).toContainText("Activo");

    // Disabling ends the admin's session at once.
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Desactivar" }).click();
    await expect(row).toContainText("Desactivado");
    await admin.page.goto("/admin/galeria");
    await expect(admin.page).toHaveURL(/\/login/);
    await logIn(admin.page, USERNAME, OWN_PASSWORD);
    await expect(admin.page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();

    // Back in, with a fresh temporary password.
    await row.getByRole("button", { name: "Reactivar" }).click();
    await expect(row).toContainText("Activo");
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Resetear contraseña" }).click();
    const reset = (await page.getByTestId("temporary-password").locator("code").textContent())!;
    expect(reset).not.toBe(temporary);
    await logIn(admin.page, USERNAME, reset);
    await expect(admin.page).toHaveURL(/\/cambiar-clave$/);
    await admin.context.close();
  });

  test("the owner cannot disable or reset themselves", async ({ page }) => {
    await page.goto("/admin/usuarios");
    const self = page.getByTestId("admin-row").filter({ hasText: "(vos)" });
    await expect(self).toBeVisible();
    await expect(self.getByRole("button")).toHaveCount(0);
  });
});
