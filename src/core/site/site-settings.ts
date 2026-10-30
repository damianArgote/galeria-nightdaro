export const THEME_ACCENTS = ["violet", "sky", "green"] as const;
export type ThemeAccent = (typeof THEME_ACCENTS)[number];

export const SOCIAL_NETWORKS = ["instagram", "x", "facebook", "tiktok"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export interface SiteTheme {
  accent: ThemeAccent;
}

export type SiteSocials = Partial<Record<SocialNetwork, string>>;

export interface SiteSeo {
  title?: string;
  description?: string;
}

export interface SiteSettings {
  name: string;
  bio: string | null;
  bannerMediaId: string | null;
  theme: SiteTheme;
  socials: SiteSocials;
  ageGateEnabled: boolean;
  seo: SiteSeo;
}

export const DEFAULT_THEME: SiteTheme = { accent: "violet" };
