import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { FakeSiteSettingsRepository } from "@/infra/site/fake-site-settings-repository";
import { EMPTY_SITE_SETTINGS, GetSiteSettings } from "./get-site-settings";
import type { SiteSettings } from "./site-settings";
import { UpdateSiteSettings } from "./update-site-settings";

const seeded: SiteSettings = {
  ...EMPTY_SITE_SETTINGS,
  bannerMediaId: "11111111-1111-4111-8111-111111111111",
  socials: { instagram: "https://www.instagram.com/nightdaro" },
};

const validInput = {
  name: " NightDaro ",
  bio: "Súcubos y demonios de tinta.",
  theme: { accent: "sky" as const },
  ageGateEnabled: false,
  socials: { instagram: "https://www.instagram.com/nightdaro", x: "", facebook: "" },
  seo: { title: "NightDaro", description: "" },
};

describe("GetSiteSettings", () => {
  it("returns defaults when the row does not exist yet", async () => {
    await expect(new GetSiteSettings(new FakeSiteSettingsRepository()).execute()).resolves.toEqual(
      EMPTY_SITE_SETTINGS,
    );
  });
});

describe("UpdateSiteSettings", () => {
  it("saves texts, theme, age gate and socials, dropping empty values", async () => {
    const repo = new FakeSiteSettingsRepository(seeded);

    const updated = await new UpdateSiteSettings(repo).execute(validInput);

    expect(updated).toEqual({
      name: "NightDaro",
      bio: "Súcubos y demonios de tinta.",
      bannerMediaId: seeded.bannerMediaId,
      theme: { accent: "sky" },
      ageGateEnabled: false,
      socials: { instagram: "https://www.instagram.com/nightdaro" },
      seo: { title: "NightDaro" },
    });
    expect(await repo.get()).toEqual(updated);
  });

  it("keeps the banner, which only uploads change", async () => {
    const repo = new FakeSiteSettingsRepository(seeded);
    const input = { ...validInput, bannerMediaId: null } as typeof validInput;

    const updated = await new UpdateSiteSettings(repo).execute(input);

    expect(updated.bannerMediaId).toBe(seeded.bannerMediaId);
  });

  it("rejects non-https social links and an empty name", async () => {
    const update = new UpdateSiteSettings(new FakeSiteSettingsRepository(seeded));

    await expect(
      update.execute({ ...validInput, socials: { x: "javascript:alert(1)" } }),
    ).rejects.toThrow(ZodError);
    await expect(
      update.execute({ ...validInput, socials: { x: "http://x.com/a" } }),
    ).rejects.toThrow(ZodError);
    await expect(update.execute({ ...validInput, name: "  " })).rejects.toThrow(ZodError);
  });
});
