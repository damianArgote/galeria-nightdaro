import { describe, expect, it } from "vitest";
import { galleryRewrites, isCrawler } from "./routing";

describe("gallery routing", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1",
    "Twitterbot/1.0",
    "Mozilla/5.0 (compatible; Discordbot/2.0)",
    "WhatsApp/2.23",
    "TelegramBot (like TwitterBot)",
    "redditbot/1.0",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
  ])("treats %s as a crawler", (ua) => {
    expect(isCrawler(ua)).toBe(true);
  });

  it("treats a browser as a person and a missing user agent as a crawler", () => {
    expect(
      isCrawler(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(isCrawler(null)).toBe(true);
  });

  it("checks crawlers before the cookie and falls back to sfw for every page", () => {
    const home = galleryRewrites().filter((r) => r.source === "/");

    expect(home.map((r) => r.destination)).toEqual([
      "/g/sfw/inicio",
      "/g/sfw/inicio",
      "/g/adult/inicio",
      "/g/sfw/inicio",
    ]);
    expect(home[2]!.has).toEqual([{ type: "cookie", key: "age_ok", value: "1" }]);
    expect(home.at(-1)).not.toHaveProperty("has");
    expect(new Set(galleryRewrites().map((r) => r.source)).size).toBe(5);
  });
});
