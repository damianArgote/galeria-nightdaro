import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";
import { uploadArtwork } from "./helpers";

// Only this spec's artworks: the demo seed fills the same tab.
const rows = (page: Page) => page.getByTestId("artwork-row").filter({ hasText: "Obra E2E" });
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

    // Leave the age gate on for the public gallery specs.
    await page.getByRole("switch", { name: "Pedir confirmación de edad" }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
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
    await expect(
      page.getByTestId("tracking-link").filter({ hasText: "/r/fansly-vip" }),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("tier").first().getByLabel("Precio")).toHaveValue("7");
    // The seed links its three example tiers, the VIP tier gets its own, plus the manual one.
    await expect(page.getByTestId("tracking-link")).toHaveCount(5);
  });

  test("tier benefits and the single highlight show on /apoyar", async ({ page }) => {
    await page.goto("/admin/links");
    const tier2 = page.getByTestId("tier").nth(1);
    await tier2.getByLabel(/Beneficios/).fill("Arte NSFW exclusivo\n\n  Acceso anticipado  ");
    await tier2.getByLabel(/Destacar/).check();
    await tier2.getByRole("button", { name: "Guardar" }).click();
    await expect(tier2.getByRole("button", { name: "Guardar" })).toBeDisabled();

    // Highlighting another tier clears the first one, without reloading the panel.
    const tier3 = page.getByTestId("tier").nth(2);
    await tier3.getByLabel(/Destacar/).check();
    await tier3.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page
        .getByTestId("tier")
        .nth(1)
        .getByLabel(/Destacar/),
    ).not.toBeChecked();
    await expect(
      page
        .getByTestId("tier")
        .nth(2)
        .getByLabel(/Destacar/),
    ).toBeChecked();

    const tooMany = page.getByTestId("tier").nth(0);
    await tooMany.getByLabel(/Beneficios/).fill("1\n2\n3\n4\n5\n6\n7");
    await tooMany.getByRole("button", { name: "Guardar" }).click();
    await expect(tooMany.getByText("Hasta 6 beneficios")).toBeVisible();

    await page.goto("/apoyar");
    const cards = page.getByTestId("tier-card");
    await expect(
      cards.filter({ hasText: "Tier 2" }).getByTestId("tier-benefits").getByRole("listitem"),
    ).toHaveText(["✦Arte NSFW exclusivo", "✦Acceso anticipado"]);
    await expect(cards.filter({ hasText: "El más elegido" })).toHaveCount(1);
    await expect(cards.filter({ hasText: "El más elegido" })).toContainText("Tier 3");
  });
});
