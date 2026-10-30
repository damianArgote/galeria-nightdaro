import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";

/**
 * End to end against a real Bunny Stream library (uses its quota). Opt-in:
 *   STREAM_LIVE=1 pnpm test:e2e timelapse-live
 */
test.describe("timelapse against Bunny Stream", () => {
  test.use({ storageState: ADMIN_STATE });
  test.skip(!process.env.STREAM_LIVE, "Set STREAM_LIVE=1 to upload to the real library");
  test.setTimeout(15 * 60_000);

  /** A 3 second animated WebM recorded in the browser (no ffmpeg needed). */
  async function recordVideo(page: Page): Promise<Buffer> {
    const base64 = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext("2d")!;
      const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((resolve) => (recorder.onstop = resolve));
      recorder.start();
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const t = (now - start) / 1000;
          ctx.fillStyle = "#150b42";
          ctx.fillRect(0, 0, 640, 360);
          ctx.fillStyle = "#b14dff";
          ctx.beginPath();
          ctx.arc(80 + t * 160, 180, 60, 0, Math.PI * 2);
          ctx.fill();
          if (t < 3) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      recorder.stop();
      await done;
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      return btoa(binary);
    });
    return Buffer.from(base64, "base64");
  }

  test("uploads a short video, it becomes ready and plays from the signed URL", async ({
    page,
  }) => {
    await page.goto("/admin/subir");
    const video = await recordVideo(page);
    expect(video.byteLength).toBeGreaterThan(1000);

    const title = `Timelapse en vivo ${Date.now()}`;
    await page
      .locator("label")
      .filter({ has: page.getByRole("radio", { name: "Timelapse" }) })
      .click();
    await page
      .getByLabel("Video", { exact: true })
      .setInputFiles({ name: "prueba.webm", mimeType: "video/webm", buffer: video });
    await page.getByLabel("Título").fill(title);
    await page.getByText("Apto para todos", { exact: true }).click();
    await page.getByText("Todos los personajes son adultos").click();
    await page.getByRole("button", { name: "Crear borrador" }).click();

    await expect(page).toHaveURL(/\/admin\/galeria\?tipo=timelapse$/, { timeout: 120_000 });
    const row = page.getByTestId("artwork-row").filter({ hasText: title });
    await expect(row.getByTestId("video-status")).toBeVisible();

    // The panel refreshes itself every 10 s while Bunny encodes.
    await expect(row.getByTestId("video-status")).toHaveText("Video listo", {
      timeout: 12 * 60_000,
    });

    const playerUrl = (await row.getByRole("link", { name: "Ver video" }).getAttribute("href"))!;
    expect(playerUrl).toMatch(
      /^https:\/\/iframe\.mediadelivery\.net\/embed\/\d+\/[0-9a-f-]+\?token=[0-9a-f]{64}&expires=\d+$/,
    );

    // Bunny answers HTTP 200 either way; a rejected token renders a "403" page without a player.
    const open = async (url: string) => {
      const player = await page.context().newPage();
      await player.goto(url);
      return player;
    };
    const signed = await open(playerUrl);
    await expect(signed.locator("video")).toBeAttached({ timeout: 30_000 });
    await expect
      .poll(() => signed.locator("video").evaluate((v: HTMLVideoElement) => v.readyState), {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(2);
    await signed.close();

    const tampered = new URL(playerUrl);
    tampered.searchParams.set("expires", String(Number(tampered.searchParams.get("expires")) + 60));
    const expired = new URL(playerUrl);
    expired.searchParams.set("expires", "1600000000");
    const unsigned = new URL(playerUrl);
    unsigned.search = "";
    for (const url of [tampered, expired, unsigned]) {
      const rejected = await open(url.toString());
      await expect(rejected.locator("body")).toHaveText(/403/);
      await expect(rejected.locator("video")).toHaveCount(0);
      await rejected.close();
    }

    // Deleting the artwork also deletes the video from the library.
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Borrar" }).click();
    await expect(row).toHaveCount(0);
  });
});
