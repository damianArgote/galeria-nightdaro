import { requireAdmin } from "@/auth";
import { ViewHeader } from "@/components/admin/panel";
import { container } from "@/infra/container";
import { SiteSettingsForm } from "./site-settings-form";

export default async function SitePage() {
  await requireAdmin();
  const settings = await container.getSiteSettings.execute();

  return (
    <>
      <ViewHeader
        kanji="編集"
        eyebrow="Lo que ve el visitante"
        title="Editar la página pública"
        description="Banner, textos, tema, puerta +18 y redes."
      />
      <SiteSettingsForm settings={settings} />
    </>
  );
}
