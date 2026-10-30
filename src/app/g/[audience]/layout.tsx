import type { Metadata } from "next";
import { AgeGate } from "@/components/gallery/age-gate";
import { SiteFooter } from "@/components/gallery/site-footer";
import { SiteHeader } from "@/components/gallery/site-header";
import { container } from "@/infra/container";
import { audienceFrom } from "../audience-params";
import { body, brush, display, mono } from "../fonts";

export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await container.getSiteSettings.execute();
  const title = settings.seo.title ?? settings.name;
  return {
    metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
    title: { default: title, template: `%s · ${settings.name}` },
    description: settings.seo.description ?? settings.bio ?? undefined,
    // Adult content labels for parental filters: rating=adult and the RTA label.
    other: { rating: "adult", RATING: "RTA-5042-1996-1400-1577-RTA" },
    openGraph: { type: "website", siteName: settings.name, title },
  };
}

export default async function GalleryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ audience: string }>;
}) {
  const audience = await audienceFrom(params);
  const settings = await container.getSiteSettings.execute();

  return (
    <div
      className={`${display.variable} ${body.variable} ${brush.variable} ${mono.variable} min-h-dvh bg-[#07041a] font-jp text-paper`}
    >
      <SiteHeader name={settings.name} />
      <main>{children}</main>
      <SiteFooter name={settings.name} socials={settings.socials} />
      {audience === "sfw" && settings.ageGateEnabled && <AgeGate />}
    </div>
  );
}
