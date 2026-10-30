import { requireAdmin } from "@/auth";
import { Panel, PanelHeader, ViewHeader } from "@/components/admin/panel";
import { CreateArtworkForm } from "./create-artwork-form";

export default async function UploadPage() {
  await requireAdmin();

  return (
    <>
      <ViewHeader
        kanji="投稿"
        eyebrow="Nueva obra"
        title="Subir a la galería"
        description="Cargá los datos y el rating. Queda como borrador hasta que la publiques desde Galería."
      />
      <Panel className="max-w-2xl">
        <PanelHeader
          title="Datos de la obra"
          description="La subida de la imagen se suma en el próximo paso; por ahora se crea sin imagen."
        />
        <CreateArtworkForm />
      </Panel>
    </>
  );
}
