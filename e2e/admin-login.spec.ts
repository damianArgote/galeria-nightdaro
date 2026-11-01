import { expect, test, type Page } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { users } from "@/db/schema";
import { Argon2PasswordHasher } from "@/infra/auth/argon2-password-hasher";
import { e2eDatabaseUrl } from "../playwright.config";
import { adminCredentials } from "./helpers";

const { username, email, password } = adminCredentials();

async function logIn(page: Page, login: string, secret: string) {
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(login);
  await page.getByLabel("Contraseña").fill(secret);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("admin access", () => {
  for (const path of ["/admin", "/admin/galeria"]) {
    test(`redirects ${path} to /login without a session`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login(\?|$)/);
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    });
  }

  test("rejects a wrong password", async ({ page }) => {
    await logIn(page, username, "definitely-wrong");
    await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("the seeded owner signs in with the username, sees the panel and signs out", async ({
    page,
  }) => {
    await logIn(page, username, password);

    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Panel" });
    for (const item of ["Resumen", "Subir", "Galería", "Página", "Links"]) {
      await expect(nav.getByRole("link", { name: item })).toBeVisible();
    }
    await expect(page.getByText(username, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an admin created before usernames can still sign in with the email", async ({ page }) => {
    test.skip(!email, "the seeded admin has no email");
    await logIn(page, email!, password);
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe("temporary password", () => {
  // Its own client IP: the login rate limit (5 per minute) is per IP and other specs log in too.
  test.use({ extraHTTPHeaders: { "x-e2e-client-ip": "198.51.100.7" } });
  const db = createDb(e2eDatabaseUrl());
  const temp = { username: "e2e-temporal", password: "Temporal-9876-xyz" };

  test.beforeAll(async () => {
    await db.db.delete(users).where(eq(users.username, temp.username));
    await db.db.insert(users).values({
      username: temp.username,
      passwordHash: await new Argon2PasswordHasher().hash(temp.password),
      role: "admin",
      mustChangePassword: true,
    });
  });

  test.afterAll(async () => {
    await db.db.delete(users).where(eq(users.username, temp.username));
    await db.close();
  });

  test("locks the panel until the admin picks their own password, then asks to log in again", async ({
    page,
  }) => {
    await logIn(page, temp.username, temp.password);
    await expect(page).toHaveURL(/\/cambiar-clave$/);
    await expect(page.getByRole("heading", { name: "Elegí tu contraseña" })).toBeVisible();

    // The panel stays locked meanwhile.
    await page.goto("/admin/galeria");
    await expect(page).toHaveURL(/\/cambiar-clave$/);

    await page.getByLabel("Contraseña temporal").fill(temp.password);
    await page.getByLabel("Contraseña nueva", { exact: true }).fill("corta");
    await page.getByLabel("Repetí la contraseña nueva").fill("corta");
    await page.getByRole("button", { name: "Guardar y volver a entrar" }).click();
    await expect(page.getByText("Al menos 12 caracteres").last()).toBeVisible();

    const mine = "una frase larga y propia";
    await page.getByLabel("Contraseña nueva", { exact: true }).fill(mine);
    await page.getByLabel("Repetí la contraseña nueva").fill(mine);
    await page.getByRole("button", { name: "Guardar y volver a entrar" }).click();
    await expect(page).toHaveURL(/\/login\?aviso=clave-cambiada$/);
    await expect(page.getByRole("status")).toHaveText("Contraseña cambiada. Entrá con la nueva.");

    await logIn(page, temp.username, temp.password);
    await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();
    await logIn(page, temp.username, mine);
    await expect(page).toHaveURL(/\/admin$/);

    // Bumping the session version (what disabling or a reset does) ends this session at once.
    await db.db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.username, temp.username));
    await page.goto("/admin/galeria");
    await expect(page).toHaveURL(/\/login/);
  });
});
