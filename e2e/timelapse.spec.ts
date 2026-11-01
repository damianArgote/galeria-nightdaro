import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { artworks } from "@/db/schema";
import { ADMIN_STATE, e2eDatabaseUrl } from "../playwright.config";
import { pngFile } from "./helpers";

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

test.describe("timelapse cover", () => {
  test.use({ storageState: ADMIN_STATE });
  const db = createDb(e2eDatabaseUrl());
  const title = "Timelapse con portada";
  let id: string;

  test.beforeAll(async () => {
    await db.db.delete(artworks).where(eq(artworks.title, title));
    const [row] = await db.db
      .insert(artworks)
      .values({
        slug: "timelapse-con-portada",
        title,
        kind: "timelapse",
        rating: "sfw",
        status: "published",
        publishedAt: new Date(),
      })
      .returning({ id: artworks.id });
    id = row!.id;
  });

  test.afterAll(async () => {
    await db.db.delete(artworks).where(eq(artworks.id, id));
    await db.close();
  });

  test("a cover uploaded in Galería becomes the card image of the public timelapse", async ({
    page,
    browser,
  }) => {
    await page.goto("/admin/galeria?tipo=timelapse");
    const row = page.getByTestId("artwork-row").filter({ hasText: title });
    await row.getByText("Subir portada").setInputFiles(await pngFile("portada.png"));
    await expect(row.getByText("Cambiar portada")).toBeVisible();

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const publicPage = await visitor.newPage();
    await publicPage.goto("/timelapses");
    const card = publicPage.getByTestId("gallery-card").filter({ hasText: title });
    await expect(card.getByTestId("artwork-image")).toBeVisible();
    await visitor.close();
  });

  test("only timelapses take a cover", async ({ page }) => {
    const [finished] = await db.db
      .select({ id: artworks.id })
      .from(artworks)
      .where(eq(artworks.kind, "finished"))
      .limit(1);
    const response = await page.request.post(`/api/admin/artworks/${finished!.id}/cover`, {
      multipart: { cover: await pngFile("x.png") },
    });
    expect(response.status()).toBe(400);
  });
});
