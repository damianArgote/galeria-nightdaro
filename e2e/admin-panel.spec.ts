import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";
import { uploadArtwork } from "./helpers";

const rows = (page: Page) => page.getByTestId("artwork-row");
const row = (page: Page, title: string) => rows(page).filter({ hasText: title });

async function createArtwork(page: Page, title: string) {
  await uploadArtwork(page, title);
  await expect(row(page, title)).toContainText("Borrador");
}

test.describe("admin panel", () => {
  test.use({ storageState: ADMIN_STATE });

  test("creates, publishes, reorders, edits and hides artworks", async ({ page }) => {
    await createArtwork(page, "Obra E2E A");
    await createArtwork(page, "Obra E2E B");
    await expect(rows(page)).toHaveText([/Obra E2E A/, /Obra E2E B/]);

    await row(page, "Obra E2E A").getByRole("button", { name: "Publicar" }).click();
    await expect(row(page, "Obra E2E A")).toContainText("Publicada");

    // Keyboard drag: lift B, move it up one place, drop.
    const grip = row(page, "Obra E2E B").getByRole("button", { name: /Mover Obra E2E B/ });
    await grip.focus();
    for (const key of ["Space", "ArrowUp", "Space"]) {
      await page.keyboard.press(key);
      // dnd-kit measures layout between key events.
      await page.waitForTimeout(150);
    }
    await expect(rows(page)).toHaveText([/Obra E2E B/, /Obra E2E A/]);
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(rows(page)).toHaveText([/Obra E2E B/, /Obra E2E A/]);

    await row(page, "Obra E2E A").getByRole("button", { name: "Editar" }).click();
    await page.locator('input[id^="edit-"][id$="-title"]').fill("Obra E2E A editada");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(row(page, "Obra E2E A editada")).toBeVisible();

    await row(page, "Obra E2E A editada").getByRole("button", { name: "Ocultar" }).click();
    await expect(row(page, "Obra E2E A editada")).toContainText("Oculta");
    await page.reload();
    await expect(row(page, "Obra E2E A editada")).toContainText("Oculta");
  });

  test("edits the public page texts, age gate and socials", async ({ page }) => {
    await page.goto("/admin/pagina");
    await page.getByLabel("Texto de presentación").fill("Bio editada desde el e2e.");
    await page.getByRole("switch", { name: "Pedir confirmación de edad" }).click();
    await page.getByLabel("Facebook").fill("https://www.facebook.com/knightcrowller");
    await page.getByLabel("X", { exact: true }).fill("not a link");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Usá un link https://")).toBeVisible();

    await page.getByLabel("X", { exact: true }).fill("https://x.com/nightcrowller3");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Texto de presentación")).toHaveValue("Bio editada desde el e2e.");
    await expect(
      page.getByRole("switch", { name: "Pedir confirmación de edad" }),
    ).not.toBeChecked();
    await expect(page.getByLabel("Facebook")).toHaveValue(
      "https://www.facebook.com/knightcrowller",
    );
  });

  test("edits tiers and tracking links", async ({ page }) => {
    await page.goto("/admin/links");
    const seeded = page.getByTestId("tier").first();
    await seeded.getByLabel("Precio").fill("7");
    await seeded.getByRole("button", { name: "Guardar" }).click();
    await expect(seeded.getByRole("button", { name: "Guardar" })).toBeDisabled();

    const newTier = page.getByTestId("new-tier");
    await newTier.getByLabel("Plataforma").selectOption("fansly");
    await newTier.getByLabel("Nombre").fill("VIP");
    await newTier.getByLabel("Precio").fill("15");
    await newTier.getByLabel("Link de suscripción").fill("https://fansly.com/nightdaro");
    await newTier.getByRole("button", { name: "Agregar" }).click();
    await expect(page.getByTestId("tier")).toHaveCount(4);

    const newLink = page.getByTestId("new-tracking-link");
    await newLink.getByLabel("Etiqueta").fill("Fansly VIP");
    await newLink.getByLabel("Código").fill("fansly-vip");
    await newLink.getByLabel("Tier").selectOption({ label: "VIP" });
    await newLink.getByLabel("Destino").fill("https://fansly.com/nightdaro");
    await newLink.getByRole("button", { name: "Agregar" }).click();
    await expect(page.getByTestId("tracking-link")).toContainText("/r/fansly-vip");

    await page.reload();
    await expect(page.getByTestId("tier").first().getByLabel("Precio")).toHaveValue("7");
    await expect(page.getByTestId("tracking-link")).toHaveCount(1);
  });
});
