import { describe, expect, it } from "vitest";
import { galleryRewrite, isCrawler } from "./routing";

describe("gallery routing", () => {
  it.each([
    ["/", "/inicio"],
    ["/en-proceso", "/en-proceso"],
    ["/timelapses", "/timelapses"],
    ["/apoyar", "/apoyar"],
    ["/obra/calabaza-pin-up", "/obra/calabaza-pin-up"],
  ])("rewrites %s", (path, target) => {
    expect(galleryRewrite(path)).toBe(target);
  });

  it.each(["/admin", "/login", "/obra/../admin", "/obra/A B", "/r/x", "/media/x/thumb"])(
    "leaves %s alone",
    (path) => {
      expect(galleryRewrite(path)).toBeNull();
    },
  );

  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1",
    "Twitterbot/1.0",
    "Mozilla/5.0 (compatible; Discordbot/2.0)",
    "WhatsApp/2.23",
    "TelegramBot (like TwitterBot)",
    "redditbot/1.0",
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
});
