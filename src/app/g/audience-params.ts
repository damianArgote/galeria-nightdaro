import { notFound } from "next/navigation";
import { isAudience, type Audience } from "@/core/gallery/audience";
import { isLocale, type Locale } from "@/components/gallery/i18n";

/** Pages are generated on the first request and cached (ISR), so the build needs no database. */
export const REVALIDATE_SECONDS = 300;

export async function audienceFrom(params: Promise<{ audience: string }>): Promise<Audience> {
  const { audience } = await params;
  if (!isAudience(audience)) notFound();
  return audience;
}

export async function localeFrom(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
