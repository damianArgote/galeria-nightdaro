import type { Metadata } from "next";
import { container } from "@/infra/container";
import { cn } from "@/lib/utils";
import { audienceFrom } from "../../audience-params";

export const revalidate = 300;
export const metadata: Metadata = { title: "Apoyar" };

const PLATFORM_NAMES = { patreon: "Patreon", onlyfans: "OnlyFans", fansly: "Fansly" } as const;
const KANJI = ["下書", "墨", "彩色", "極", "夜"];

function price(cents: number, currency: string) {
  const amount = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return currency === "USD" ? `US$${amount}` : `${amount} ${currency}`;
}

export default async function SupportPage({ params }: { params: Promise<{ audience: string }> }) {
  await audienceFrom(params);
  const tiers = await container.listPublicTiers.execute();
  // The middle tier is highlighted, like the mockup's "El más elegido".
  const hot = tiers.length >= 3 ? Math.floor(tiers.length / 2) : -1;

  return (
    <section className="border-y border-[#2e2470] bg-gradient-to-b from-[#07041a] via-[#150b42] to-[#07041a] py-[72px]">
      <div className="mx-auto max-w-[1180px] px-4">
        <p className="font-label text-xs tracking-[0.14em] text-brand-green uppercase">
          <span className="mr-2.5 font-brush text-[15px] tracking-[0.2em] text-paper normal-case">
            サポート
          </span>
          Suscripción
        </p>
        <h1 className="mb-8 font-display text-[clamp(34px,5vw,54px)] leading-none">
          Elegí tu nivel
        </h1>
        {tiers.length === 0 ? (
          <p className="text-[#aaa4d8]">Pronto vas a poder suscribirte desde acá.</p>
        ) : (
          <ul className="grid gap-[18px] md:grid-cols-3">
            {tiers.map((tier, i) => (
              <li
                key={tier.id}
                data-testid="tier-card"
                className={cn(
                  "relative flex min-w-0 flex-col gap-3.5 rounded-md border-[3px] border-black bg-[#120c33] p-6 shadow-[6px_6px_0_#000]",
                  i === hot &&
                    "border-brand-violet shadow-[6px_6px_0_#000,0_30px_60px_-30px_var(--brand-violet)]",
                )}
              >
                {i === hot && (
                  <span className="absolute -top-3.5 left-6 rounded-full bg-brand-violet px-2.5 py-1 font-label text-[11px] tracking-[0.06em] text-[#12002a]">
                    El más elegido
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
                  {price(tier.priceCents, tier.currency)}{" "}
                  <small className="font-jp text-[15px] text-[#aaa4d8]">/ mes</small>
                </p>
                {tier.linkCode ? (
                  <a
                    href={`/r/${tier.linkCode}`}
                    rel="noopener"
                    className={cn(
                      "mt-auto justify-center px-5 py-3",
                      i === hot
                        ? "gallery-cta"
                        : "inline-flex rounded-full border-[1.5px] border-[#2e2470] font-bold text-paper",
                    )}
                  >
                    Unirme como {tier.name}
                  </a>
                ) : (
                  <p className="mt-auto text-sm text-[#aaa4d8]">Muy pronto</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[13px] text-[#aaa4d8]">
          Cada botón lleva al nivel correspondiente de la plataforma.
        </p>
      </div>
    </section>
  );
}
