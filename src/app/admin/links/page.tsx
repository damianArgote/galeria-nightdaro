import { requireAdmin } from "@/auth";
import { Panel, PanelHeader, ViewHeader } from "@/components/admin/panel";
import { container } from "@/infra/container";
import { PatreonPanel } from "./patreon-panel";
import { TierEditor } from "./tier-editor";
import { TrackingLinkEditor } from "./tracking-link-editor";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ patreon?: string }>;
}) {
  await requireAdmin();
  const patreon = container.patreon;
  const [tiers, links, patreonStatus, params] = await Promise.all([
    container.listTiers.execute(),
    container.listTrackingLinks.execute(),
    patreon
      ? // A connection sealed with another PATREON_TOKEN_KEY cannot be read: offer to reconnect.
        patreon.status.execute().catch((error: unknown) => {
          console.error("Could not read the Patreon connection", error);
          return { connected: false as const };
        })
      : null,
    searchParams,
  ]);

  return (
    <>
      <ViewHeader
        kanji="支援"
        eyebrow="Patreon, OnlyFans y Fansly"
        title="Tiers y links"
        description="La galería nunca enlaza directo: cada botón pasa por un link /r/ que cuenta el clic."
      />
      <div className="grid max-w-4xl gap-6">
        <PatreonPanel status={patreonStatus} result={params.patreon} />
        <Panel>
          <PanelHeader title="Tiers" description="Los niveles que se muestran en /apoyar." />
          <div className="grid gap-3">
            {tiers.map((tier) => (
              // Remount when the highlight moves to another tier, so no form keeps a stale checkbox.
              <TierEditor key={`${tier.id}-${tier.highlighted}`} tier={tier} />
            ))}
            <TierEditor />
          </div>
        </Panel>
        <Panel>
          <PanelHeader
            title="Links de seguimiento"
            description="Cada link es /r/{código}: registra el clic y redirige al destino."
          />
          <div className="grid gap-3">
            {links.map((link) => (
              <TrackingLinkEditor key={link.id} link={link} tiers={tiers} />
            ))}
            <TrackingLinkEditor tiers={tiers} />
          </div>
        </Panel>
      </div>
    </>
  );
}
