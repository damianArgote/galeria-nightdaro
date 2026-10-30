import { z } from "zod";
import { SOCIAL_NETWORKS, THEME_ACCENTS, type SiteSettings } from "./site-settings";
import type { SiteSettingsRepository } from "./site-settings-repository";
import { EMPTY_SITE_SETTINGS } from "./get-site-settings";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

const socialUrl = z
  .union([z.literal(""), z.url({ protocol: /^https$/, error: "Usá un link https://" })])
  .transform((value) => value || undefined)
  .optional();

export const updateSiteSettingsSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  bio: z
    .string()
    .trim()
    .max(600)
    .transform((value) => value || null)
    .nullable(),
  theme: z.object({ accent: z.enum(THEME_ACCENTS) }),
  ageGateEnabled: z.boolean(),
  socials: z.object(
    Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, socialUrl])) as Record<
      (typeof SOCIAL_NETWORKS)[number],
      typeof socialUrl
    >,
  ),
  seo: z.object({ title: optionalText(70), description: optionalText(160) }),
});
export type UpdateSiteSettingsInput = z.input<typeof updateSiteSettingsSchema>;

/** Edits the public page texts, theme, age gate and socials. The banner is set by uploads. */
export class UpdateSiteSettings {
  constructor(private readonly settings: SiteSettingsRepository) {}

  async execute(input: UpdateSiteSettingsInput): Promise<SiteSettings> {
    const fields = updateSiteSettingsSchema.parse(input);
    const current = (await this.settings.get()) ?? EMPTY_SITE_SETTINGS;

    const socials = Object.fromEntries(
      Object.entries(fields.socials).filter(([, url]) => url !== undefined),
    );
    const seo = Object.fromEntries(
      Object.entries(fields.seo).filter(([, text]) => text !== undefined),
    );

    const updated: SiteSettings = { ...current, ...fields, socials, seo };
    await this.settings.save(updated);
    return updated;
  }
}
