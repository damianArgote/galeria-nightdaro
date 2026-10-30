import { expect, type Page } from "@playwright/test";

export function adminCredentials() {
  const email = process.env.SEED_DARO_EMAIL;
  const password = process.env.SEED_DARO_PASSWORD;
  if (!email || !password) throw new Error("SEED_DARO_EMAIL and SEED_DARO_PASSWORD are required");
  return { email, password };
}

export async function signIn(page: Page) {
  const { email, password } = adminCredentials();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
