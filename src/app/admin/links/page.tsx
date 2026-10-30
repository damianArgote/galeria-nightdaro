import { requireAdmin } from "@/auth";
import { Panel, PanelHeader, ViewHeader } from "@/components/admin/panel";
import { container } from "@/infra/container";
import { TierEditor } from "./tier-editor";
import { TrackingLinkEditor } from "./tracking-link-editor";

export default async function LinksPage() {
  await requireAdmin();
  const [tiers, links] = await Promise.all([
    container.listTiers.execute(),
    container.listTrackingLinks.execute(),
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
        <Panel>
          <PanelHeader title="Tiers" description="Los niveles que se muestran en /apoyar." />
          <div className="grid gap-3">
            {tiers.map((tier) => (
              <TierEditor key={tier.id} tier={tier} />
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
