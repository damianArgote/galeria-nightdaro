import { eq } from "drizzle-orm";
import { DEFAULT_THEME, type SiteSettings } from "@/core/site/site-settings";
import type { SiteSettingsRepository } from "@/core/site/site-settings-repository";
import type { Db } from "@/db/client";
import { siteSettings } from "@/db/schema";

const SINGLE_ROW_ID = 1;

export class DrizzleSiteSettingsRepository implements SiteSettingsRepository {
  constructor(private readonly db: Db) {}

  async get(): Promise<SiteSettings | null> {
    const [row] = await this.db
      .select({
        name: siteSettings.name,
        bio: siteSettings.bio,
        bannerMediaId: siteSettings.bannerMediaId,
        theme: siteSettings.theme,
        socials: siteSettings.socials,
        ageGateEnabled: siteSettings.ageGateEnabled,
        seo: siteSettings.seo,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, SINGLE_ROW_ID));
    if (!row) return null;
    // Rows seeded before the theme had an accent hold `{}`.
    return { ...row, theme: { ...DEFAULT_THEME, ...row.theme } };
  }

  async save(settings: SiteSettings): Promise<void> {
    await this.db
      .insert(siteSettings)
      .values({ id: SINGLE_ROW_ID, ...settings })
      .onConflictDoUpdate({ target: siteSettings.id, set: settings });
  }
}
