import { expect, type Page } from "@playwright/test";
import sharp from "sharp";

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
