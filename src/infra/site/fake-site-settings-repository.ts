import type { SiteSettings } from "@/core/site/site-settings";
import type { SiteSettingsRepository } from "@/core/site/site-settings-repository";

export class FakeSiteSettingsRepository implements SiteSettingsRepository {
  constructor(private settings: SiteSettings | null = null) {}

  async get(): Promise<SiteSettings | null> {
    return this.settings && structuredClone(this.settings);
  }

  async save(settings: SiteSettings): Promise<void> {
    this.settings = structuredClone(settings);
  }
}
