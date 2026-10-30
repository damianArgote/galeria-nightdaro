import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";

test.describe("timelapses without Bunny Stream configured", () => {
  test.use({ storageState: ADMIN_STATE });
  test.skip(
    !!process.env.BUNNY_STREAM_LIBRARY_ID,
    "Bunny Stream is configured in this environment",
  );

  test("explains what is missing and creates nothing", async ({ page }) => {
    await page.goto("/admin/subir");
    await page
      .locator("label")
      .filter({ has: page.getByRole("radio", { name: "Timelapse" }) })
      .click();
    await page.getByLabel("Video", { exact: true }).setInputFiles({
      name: "proceso.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("not really a video"),
    });
    await page.getByLabel("Título").fill("Timelapse sin Stream");
    await page.getByText("Apto para todos", { exact: true }).click();
    await page.getByText("Todos los personajes son adultos").click();
    await page.getByRole("button", { name: "Crear borrador" }).click();

    await expect(page.getByTestId("form-error")).toContainText("necesitan Bunny Stream");
    await page.goto("/admin/galeria?tipo=timelapse");
    await expect(page.getByText("Timelapse sin Stream")).toHaveCount(0);
  });

  test("keeps the webhook disabled", async ({ request }) => {
    const response = await request.post("/api/webhooks/bunny-stream", {
      data: { VideoGuid: "x", Status: 3 },
    });
    expect(response.status()).toBe(404);
  });
});

test.describe("timelapse rating", () => {
  test.use({ storageState: ADMIN_STATE });

  test("explicit is not available for timelapses", async ({ page }) => {
    await page.goto("/admin/subir");
    const explicit = page.getByRole("radio", { name: /^Explícito/ });
    await page.getByText("Explícito", { exact: true }).click();
    await expect(explicit).toBeChecked();

    await page
      .locator("label")
      .filter({ has: page.getByRole("radio", { name: "Timelapse" }) })
      .click();

    await expect(explicit).toBeDisabled();
    await expect(explicit).not.toBeChecked();
    await expect(page.getByText("No disponible para timelapses")).toBeVisible();
  });
});
