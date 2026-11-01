import { expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { seedAdminsFromEnv } from "@/db/seed-admins";

/** The seeded owner, from SEED_ADMIN_USERNAME (or SEED_ADMIN_EMAIL) and SEED_ADMIN_PASSWORD. */
export function adminCredentials() {
  return seedAdminsFromEnv(process.env)[0]!;
}

export async function signIn(page: Page) {
  const { username, password } = adminCredentials();
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

export async function pngFile(name = "obra.png", color = "#b14dff") {
  const buffer = await sharp({
    create: { width: 900, height: 1200, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  return { name, mimeType: "image/png", buffer };
}

/** Uploads a draft through /admin/subir and waits for the gallery. */
export async function uploadArtwork(page: Page, title: string, rating = "Apto para todos") {
  await page.goto("/admin/subir");
  await page.getByLabel("Imagen").setInputFiles(await pngFile());
  await page.getByLabel("Título").fill(title);
  await page.getByText(rating, { exact: true }).click();
  await page.getByText("Todos los personajes son adultos").click();
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await expect(page).toHaveURL(/\/admin\/galeria\?tipo=finished$/);
}
