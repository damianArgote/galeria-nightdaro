import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { DEMO_ARTWORKS } from "@/db/seed-demo";

const titles = (rating: string, kind = "finished") =>
  DEMO_ARTWORKS.filter((a) => a.rating === rating && a.kind === kind).map((a) => a.title);
const SFW = titles("sfw");
const ADULT_ONLY = [...titles("suggestive"), ...titles("explicit")];
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

async function acceptGate(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Tengo 18 o más, entrar" }).click();
  await expect(page.getByRole("dialog", { name: /Contenido para adultos/ })).toHaveCount(0);
  await expect(page.getByTestId("gallery-card").filter({ hasText: ADULT_ONLY[0]! })).toBeVisible();
}

/** id of an artwork, read from its thumbnail URL in the adult gallery. */
async function artworkId(page: Page, title: string) {
  const src = await page
    .getByTestId("gallery-card")
    .filter({ hasText: title })
    .getByTestId("artwork-image")
    .getAttribute("src");
  return src!.split("/")[2]!;
}

test.describe("public gallery without the age gate", () => {
  test("serves only sfw artworks in the HTML and shows the age gate", async ({ page }) => {
    for (const [path, kind] of [
      ["/", "finished"],
      ["/en-proceso", "wip"],
    ] as const) {
      const html = await (await page.request.get(path)).text();
      for (const title of titles("sfw", kind)) expect(html).toContain(title);
      for (const title of [...titles("suggestive", kind), ...titles("explicit", kind)]) {
        expect(html).not.toContain(title);
      }
      expect(html).not.toContain('data-rating="explicit"');
      expect(html).not.toContain('data-rating="suggestive"');
    }

    await page.goto("/");
    await expect(page.getByRole("dialog", { name: /Contenido para adultos/ })).toBeVisible();
    await expect(page.getByTestId("gallery-card")).toHaveCount(SFW.length);
  });

  test("labels the site as adult content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="rating"]')).toHaveAttribute("content", "adult");
    await expect(page.locator('meta[name="RATING"]')).toHaveAttribute(
      "content",
      "RTA-5042-1996-1400-1577-RTA",
    );
  });

  test("Salir leaves the site", async ({ page }) => {
    await page.route("https://www.google.com/**", (route) =>
      route.fulfill({ body: "<title>Google</title>", contentType: "text/html" }),
    );
    await page.goto("/");
    await page.getByRole("link", { name: "Salir" }).click();
    await expect(page).toHaveURL(/^https:\/\/www\.google\.com\//);
  });

  test("links tiers through /r/{code}, which redirects to the platform", async ({ page }) => {
    await page.goto("/apoyar");
    const buttons = page.getByTestId("tier-card").getByRole("link");
    await expect(buttons.first()).toBeVisible();
    const hrefs = await buttons.evaluateAll((links) => links.map((l) => l.getAttribute("href")));
    // The seeded tiers, plus any tier the admin specs added (each gets its own link).
    expect(hrefs).toEqual(expect.arrayContaining(["/r/patreon-1", "/r/patreon-2", "/r/patreon-3"]));
    for (const href of hrefs) expect(href).toMatch(/^\/r\/[a-z0-9-]+$/);
    const html = await (await page.request.get("/apoyar")).text();
    expect(html).not.toContain("patreon.com");

    const redirect = await page.request.get("/r/patreon-1", { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers().location).toBe("https://www.patreon.com/cw/Ndaro");
  });

  test("/g/* cannot be requested directly", async ({ page }) => {
    for (const path of ["/g/adult", "/g/adult/en-proceso", "/g/sfw"]) {
      expect((await page.request.get(path)).status()).toBe(404);
    }
  });
});

test.describe("public gallery after the age gate", () => {
  test("shows every rating, remembers it for a year and protects the images", async ({
    page,
    context,
  }) => {
    await acceptGate(page);

    for (const title of [...SFW, ...ADULT_ONLY]) {
      await expect(page.getByTestId("gallery-card").filter({ hasText: title })).toBeVisible();
    }
    const cookie = (await context.cookies()).find((c) => c.name === "age_ok");
    expect(cookie).toMatchObject({ value: "1", httpOnly: true, sameSite: "Lax" });
    const days = (cookie!.expires * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(364);

    const image = page.getByTestId("artwork-image").first();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(image).toHaveAttribute("draggable", "false");
    const blocked = await image.evaluate((img) => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      img.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(blocked).toBe(true);
    const placeholder = await image.evaluate(
      (img) => getComputedStyle(img.parentElement!).backgroundImage,
    );
    expect(placeholder).toContain("data:image/webp;base64");
  });

  test("the files of adult artworks need the cookie too", async ({ page, browser }) => {
    await acceptGate(page);
    const explicit = DEMO_ARTWORKS.find((a) => a.rating === "explicit" && a.kind === "finished")!;
    const id = await artworkId(page, explicit.title);
    expect((await page.request.get(`/media/${id}/thumb`, { maxRedirects: 0 })).status()).toBe(302);

    const anonymous: BrowserContext = await browser.newContext();
    expect((await anonymous.request.get(`/media/${id}/thumb`, { maxRedirects: 0 })).status()).toBe(
      404,
    );
    const slug = explicit.title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    expect((await anonymous.request.get(`/obra/${slug}`)).status()).toBe(404);
    expect((await page.request.get(`/obra/${slug}`)).status()).toBe(200);
    await anonymous.close();
  });

  test("crawlers only get sfw, even with the cookie", async ({ browser }) => {
    const bot = await browser.newContext({ userAgent: GOOGLEBOT });
    await bot.addCookies([{ name: "age_ok", value: "1", url: "http://localhost:3100" }]);
    const html = await (await bot.request.get("/")).text();
    for (const title of SFW) expect(html).toContain(title);
    for (const title of ADULT_ONLY) expect(html).not.toContain(title);
    await bot.close();
  });

  test("Open Graph only carries a sfw image", async ({ page }) => {
    await acceptGate(page);
    const sfwSlug = "calabaza-pin-up";
    await page.goto(`/obra/${sfwSlug}`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/media\/[0-9a-f-]+\/preview$/,
    );

    await page.goto("/obra/sucubo-de-tinta");
    await expect(page.getByRole("heading", { name: "Súcubo de tinta", level: 1 })).toBeVisible();
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  });
});
