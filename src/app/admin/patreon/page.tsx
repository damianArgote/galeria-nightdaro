import Link from "next/link";
import { requireAdminPage } from "@/auth";
import { Panel, ViewHeader } from "@/components/admin/panel";
import type { PatreonSyncPreview } from "@/core/patreon/post-sync";
import { container } from "@/infra/container";
import { SyncReview } from "./sync-review";

/** The posts already on Patreon next to the gallery: review, then link or create drafts. */
export default async function PatreonSyncPage() {
  await requireAdminPage();
  const patreon = container.patreon;
  const status = patreon ? await patreon.status.execute().catch(() => null) : null;

  let preview: PatreonSyncPreview | null = null;
  let error: string | null = null;
  if (patreon && status?.connected) {
    try {
      preview = await patreon.syncPreview.execute();
    } catch (cause) {
      console.error("Could not read the Patreon posts", cause);
      error = "Patreon no respondió. Probá de nuevo en unos minutos.";
    }
  }

  return (
    <>
      <ViewHeader
        kanji="同期"
        eyebrow="Patreon"
        title="Sincronizar con Patreon"
        description="Los posts que ya están en Patreon, al lado de la galería. Revisá y confirmá: nada se vincula ni se crea solo."
      />
      {!preview ? (
        <Panel className="max-w-3xl">
          <p className="text-sm text-muted-foreground">
            {error ?? "Primero conectá Patreon en "}
            {!error && (
              <Link href="/admin/links" className="underline underline-offset-2">
                Tiers y links
              </Link>
            )}
            {!error && "."}
          </p>
        </Panel>
      ) : (
        <SyncReview preview={preview} />
      )}
    </>
  );
}
