import type { Metadata } from "next";
import { container } from "@/infra/container";
import { cn } from "@/lib/utils";
import { messages, type Locale } from "@/components/gallery/i18n";
import { audienceFrom, localeFrom } from "../../../audience-params";

export const revalidate = 300;
type Params = Promise<{ locale: string; audience: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: messages[await localeFrom(params)].support.metaTitle };
}

const PLATFORM_NAMES = { patreon: "Patreon", onlyfans: "OnlyFans", fansly: "Fansly" } as const;
const KANJI = ["下書", "墨", "彩色", "極", "夜"];
/** Two tiers sit side by side instead of leaving an empty third column. */
const COLUMNS = ["", "md:grid-cols-1 md:max-w-md", "md:grid-cols-2 md:max-w-3xl", "md:grid-cols-3"];

function price(cents: number, currency: string, locale: Locale) {
  const amount = new Intl.NumberFormat(messages[locale].numberLocale, {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return currency === "USD" ? `US$${amount}` : `${amount} ${currency}`;
}

export default async function SupportPage({ params }: { params: Params }) {
  await audienceFrom(params);
  const locale = await localeFrom(params);
  const t = messages[locale].support;
  const tiers = await container.listPublicTiers.execute();

  return (
    <section className="border-y border-[#2e2470] bg-gradient-to-b from-[#07041a] via-[#150b42] to-[#07041a] py-[72px]">
      <div className="mx-auto max-w-[1180px] px-4">
        <p className="font-label text-xs tracking-[0.14em] text-brand-green uppercase">
          <span className="mr-2.5 font-brush text-[15px] tracking-[0.2em] text-paper normal-case">
            サポート
          </span>
          {t.eyebrow}
        </p>
        <h1 className="mb-8 font-display text-[clamp(34px,5vw,54px)] leading-none">{t.title}</h1>
        {tiers.length === 0 ? (
          <p className="text-[#aaa4d8]">{t.empty}</p>
        ) : (
          <ul className={cn("grid gap-[18px]", COLUMNS[Math.min(tiers.length, 3)])}>
            {tiers.map((tier, i) => {
              const hot = tier.highlighted;
              return (
                <li
                  key={tier.id}
                  data-testid="tier-card"
                  className={cn(
                    "relative flex min-w-0 flex-col gap-3.5 rounded-md border-[3px] border-black bg-[#120c33] p-6 shadow-[6px_6px_0_#000]",
                    hot &&
                      "border-brand-violet shadow-[6px_6px_0_#000,0_30px_60px_-30px_var(--brand-violet)]",
                  )}
                >
                  {hot && (
                    <span className="absolute -top-3.5 left-6 rounded-full bg-brand-violet px-2.5 py-1 font-label text-[11px] tracking-[0.06em] text-[#12002a]">
                      {t.highlighted}
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-label text-xs tracking-[0.14em] text-[#aaa4d8] uppercase">
                        {PLATFORM_NAMES[tier.platform]}
                      </p>
                      <h2 className="font-display text-[26px] leading-tight">{tier.name}</h2>
                    </div>
                    <span
                      aria-hidden
                      className="font-brush text-5xl leading-none text-paper opacity-90"
                    >
                      {KANJI[i % KANJI.length]}
                    </span>
                  </div>
                  <p className="font-display text-[44px] leading-none">
                    {price(tier.priceCents, tier.currency, locale)}{" "}
                    <small className="font-jp text-[15px] text-[#aaa4d8]">{t.perMonth}</small>
                  </p>
                  {tier.benefits.length > 0 && (
                    <ul data-testid="tier-benefits" className="grid gap-2 text-[15px]">
                      {tier.benefits.map((benefit, index) => (
                        <li key={index} className="flex gap-2">
                          <span aria-hidden className="text-brand-green">
                            ✦
                          </span>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  )}
                  {tier.linkCode ? (
                    <a
                      href={`/r/${tier.linkCode}`}
                      rel="noopener"
                      className={cn(
                        "mt-auto justify-center px-5 py-3",
                        hot
                          ? "gallery-cta"
                          : "inline-flex rounded-full border-[1.5px] border-[#2e2470] font-bold text-paper",
                      )}
                    >
                      {t.join(tier.name)}
                    </a>
                  ) : (
                    <p className="mt-auto text-sm text-[#aaa4d8]">{t.soon}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-[13px] text-[#aaa4d8]">{t.note}</p>
      </div>
    </section>
  );
}
