import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { ADMIN_STATE, E2E_STORAGE_DIR } from "../playwright.config";
import { pngFile } from "./helpers";

const files = async (zone: string) =>
  (await readdir(join(E2E_STORAGE_DIR, zone), { recursive: true }).catch(() => [])).filter((f) =>
    /\.\w+$/.test(f),
  );

test.describe("image upload", () => {
  test.use({ storageState: ADMIN_STATE });

  test("generates the variants and never exposes the original's key", async ({ page }) => {
    const photo = await sharp({
      create: {
        width: 3200,
        height: 2400,
        channels: 3,
        background: "#000",
        noise: { type: "gaussian", mean: 128, sigma: 50 },
      },
    })
      .jpeg()
      .toBuffer();

    const before = new Set([...(await files("originals")), ...(await files("public"))]);
    const added = async (zone: string) => (await files(zone)).filter((f) => !before.has(f));

    await page.goto("/admin/subir");
    await page.getByLabel("Imagen").setInputFiles({
      name: "foto.jpg",
      mimeType: "image/jpeg",
      buffer: photo,
    });
    await page.getByLabel("Título").fill("Foto grande");
    await page.getByText("Apto para todos", { exact: true }).click();
    await page.getByText("Todos los personajes son adultos").click();
    const uploaded = page.waitForResponse("**/api/admin/artworks");
    await page.getByRole("button", { name: "Crear borrador" }).click();

    const response = await uploaded;
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toBe('{"ok":true,"data":{"kind":"finished"}}');
    await expect(page).toHaveURL(/\/admin\/galeria\?tipo=finished$/);

    // Variants on disk: original in the private zone, thumb + preview in the public one.
    const originals = await added("originals");
    const publics = await added("public");
    expect(originals).toHaveLength(1);
    expect(publics).toHaveLength(2);
    const original = originals.find((f) => f.endsWith("original.jpg"));
    const preview = publics.find((f) => f.endsWith("preview.webp"));
    expect(original).toBeDefined();
    expect(publics.some((f) => f.endsWith("thumb.webp"))).toBe(true);
    const meta = await sharp(await readFile(join(E2E_STORAGE_DIR, "public", preview!))).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);

    // The thumbnail loads through a signed URL.
    const thumb = page
      .getByTestId("artwork-row")
      .filter({ hasText: "Foto grande" })
      .getByTestId("artwork-thumb");
    await expect(thumb).toHaveAttribute(
      "src",
      /^\/dev-media\/nightdaro\/.+\/thumb\.webp\?token=HS256-.+&expires=\d+$/,
    );
    await expect
      .poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // No page or response carries the original's key (or any private-zone path).
    const originalKey = original!.replaceAll("\\", "/");
    for (const path of ["/admin/galeria", "/admin/galeria?tipo=finished", "/admin/subir"]) {
      const html = await (await page.request.get(path)).text();
      expect(html).not.toContain(originalKey);
      expect(html).not.toContain("original.jpg");
      expect(html).not.toContain("originals");
    }
    expect(body).not.toContain("original");
  });

  test("the signed URL only works unmodified and before it expires", async ({ page }) => {
    await page.goto("/admin/galeria");
    const src = await page.getByTestId("artwork-thumb").first().getAttribute("src");
    expect(src).toBeTruthy();
    const url = new URL(src!, "http://localhost");

    expect((await page.request.get(url.pathname + url.search)).status()).toBe(200);

    const expired = new URL(url);
    expired.searchParams.set("expires", String(Math.floor(Date.now() / 1000) - 1));
    expect((await page.request.get(expired.pathname + expired.search)).status()).toBe(403);

    const later = new URL(url);
    later.searchParams.set("expires", String(Number(url.searchParams.get("expires")) + 86_400));
    expect((await page.request.get(later.pathname + later.search)).status()).toBe(403);

    const otherFile = url.pathname.replace("thumb.webp", "preview.webp") + url.search;
    expect((await page.request.get(otherFile)).status()).toBe(403);

    const originalPath = url.pathname.replace("thumb.webp", "original.jpg");
    expect((await page.request.get(originalPath + url.search)).status()).toBe(403);
  });

  test("rejects an SVG and an .exe renamed to .jpg without creating the artwork", async ({
    page,
  }) => {
    const fakes = [
      {
        name: "dibujo.jpg",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'),
      },
      { name: "programa.jpg", buffer: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200)]) },
    ];
    for (const fake of fakes) {
      await page.goto("/admin/subir");
      await page.getByLabel("Imagen").setInputFiles({ ...fake, mimeType: "image/jpeg" });
      await page.getByLabel("Título").fill(`Falsa ${fake.name}`);
      await page.getByText("Apto para todos", { exact: true }).click();
      await page.getByText("Todos los personajes son adultos").click();
      await page.getByRole("button", { name: "Crear borrador" }).click();

      await expect(page.getByTestId("form-error")).toHaveText(
        "Solo se aceptan imágenes JPG, PNG o WebP",
      );
      await expect(page).toHaveURL(/\/admin\/subir$/);
    }

    await page.goto("/admin/galeria");
    await expect(page.getByTestId("artwork-row").filter({ hasText: "Falsa" })).toHaveCount(0);
  });

  test("requires the rating and the adults confirmation", async ({ page }) => {
    await page.goto("/admin/subir");
    await page.getByLabel("Imagen").setInputFiles(await pngFile());
    await page.getByLabel("Título").fill("Sin confirmar");
    await page.getByRole("button", { name: "Crear borrador" }).click();

    await expect(page.getByText("Elegí un rating")).toBeVisible();
    await expect(page.getByText("Confirmá que todos los personajes son adultos")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/subir$/);
  });

  test("an upload without a session is refused", async ({ browser }) => {
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const response = await anonymous.request.post("/api/admin/artworks", {
      multipart: {
        title: "Intrusa",
        kind: "finished",
        rating: "sfw",
        charactersAreAdults: "true",
        image: await pngFile(),
      },
    });
    expect(response.status()).toBe(401);
    await anonymous.close();
  });

  test("changing the rating to explicit replaces the public image; deleting removes it", async ({
    page,
  }) => {
    await page.goto("/admin/subir");
    await page.getByLabel("Imagen").setInputFiles(await pngFile("rating.png", "#ffb84d"));
    await page.getByLabel("Título").fill("Cambio de rating");
    await page.getByText("Apto para todos", { exact: true }).click();
    await page.getByText("Todos los personajes son adultos").click();
    await page.getByRole("button", { name: "Crear borrador" }).click();
    await expect(page).toHaveURL(/\/admin\/galeria\?tipo=finished$/);

    const row = page.getByTestId("artwork-row").filter({ hasText: "Cambio de rating" });
    const thumb = row.getByTestId("artwork-thumb");
    const oldSrc = (await thumb.getAttribute("src"))!;

    await row.getByRole("button", { name: "Editar" }).click();
    await row.getByText("Explícito", { exact: true }).click();
    await row.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(row).toContainText("Explícito");

    await expect(thumb).not.toHaveAttribute("src", oldSrc);
    const newSrc = (await thumb.getAttribute("src"))!;
    expect(newSrc).toMatch(/thumb-[0-9a-f]{8}\.webp\?token=/);
    expect((await page.request.get(oldSrc)).status()).toBe(404);
    expect((await page.request.get(newSrc)).status()).toBe(200);

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Borrar" }).click();
    await expect(row).toHaveCount(0);
    expect((await page.request.get(newSrc)).status()).toBe(404);
  });
});
