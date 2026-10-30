import type { SiteSettings } from "./site-settings";

/** The site has a single settings row. */
export interface SiteSettingsRepository {
  get(): Promise<SiteSettings | null>;
  save(settings: SiteSettings): Promise<void>;
}
