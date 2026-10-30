import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";

test.describe("timelapses without Bunny Stream configured", () => {
  test.use({ storageState: ADMIN_STATE });

  test("explains what is missing and creates nothing", async ({ page }) => {
    await page.goto("/admin/subir");
    await page
      .locator("label")
      .filter({ has: page.getByRole("radio", { name: "Timelapse" }) })
      .click();
    await page.getByLabel("Video").setInputFiles({
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
