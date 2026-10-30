import { DEFAULT_THEME, type SiteSettings } from "./site-settings";
import type { SiteSettingsRepository } from "./site-settings-repository";

export const EMPTY_SITE_SETTINGS: SiteSettings = {
  name: "NightDaro",
  bio: null,
  bannerMediaId: null,
  theme: DEFAULT_THEME,
  socials: {},
  ageGateEnabled: true,
  seo: {},
};

export class GetSiteSettings {
  constructor(private readonly settings: SiteSettingsRepository) {}

  async execute(): Promise<SiteSettings> {
    return (await this.settings.get()) ?? EMPTY_SITE_SETTINGS;
  }
}
