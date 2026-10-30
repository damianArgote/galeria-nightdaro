import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CreateTier } from "@/core/links/create-tier";
import { CreateTrackingLink } from "@/core/links/create-tracking-link";
import { DeleteTier } from "@/core/links/delete-tier";
import { GetSiteSettings } from "@/core/site/get-site-settings";
import { UpdateSiteSettings } from "@/core/site/update-site-settings";
import { seed } from "@/db/seed";
import { DrizzleSiteSettingsRepository } from "@/infra/site/drizzle-site-settings-repository";
import { createTestDb, databaseUrl } from "../../../tests/helpers/test-db";
import { DrizzleTierRepository, DrizzleTrackingLinkRepository } from "./drizzle-link-repositories";

describe.skipIf(!databaseUrl)("site settings and links against Postgres", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;

  beforeAll(async () => {
    testDb = await createTestDb("site_links");
  });

  beforeEach(async () => {
    await testDb.reset();
    await seed(testDb.db, []);
  });

  afterAll(async () => {
    await testDb?.close();
  });

  it("reads the seeded settings with the default accent and saves edits", async () => {
    const repo = new DrizzleSiteSettingsRepository(testDb.db);

    const seeded = await new GetSiteSettings(repo).execute();
    expect(seeded).toMatchObject({ name: "NightDaro", theme: { accent: "violet" } });

    await new UpdateSiteSettings(repo).execute({
      name: "NightDaro",
      bio: "Bio nueva",
      theme: { accent: "green" },
      ageGateEnabled: true,
      socials: { x: "https://x.com/nightcrowller3" },
      seo: {},
    });

    expect(await repo.get()).toMatchObject({
      bio: "Bio nueva",
      theme: { accent: "green" },
      socials: { x: "https://x.com/nightcrowller3" },
    });
  });

  it("keeps a tracking link working when its tier is deleted", async () => {
    const tiers = new DrizzleTierRepository(testDb.db);
    const links = new DrizzleTrackingLinkRepository(testDb.db);
    const tier = await new CreateTier(tiers).execute({
      platform: "fansly",
      name: "VIP",
      priceCents: 1500,
      url: "https://fansly.com/nightdaro",
    });
    expect(tier.position).toBe(3);
    const link = await new CreateTrackingLink(links, tiers).execute({
      label: "Fansly VIP",
      targetUrl: "https://fansly.com/nightdaro",
      code: "fansly-vip",
      tierId: tier.id,
    });

    await new DeleteTier(tiers).execute({ id: tier.id });

    expect(await links.findByCode("fansly-vip")).toEqual({ ...link, tierId: null });
  });
});
