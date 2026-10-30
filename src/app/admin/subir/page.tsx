import { requireAdmin } from "@/auth";
import { Panel, PanelHeader, ViewHeader } from "@/components/admin/panel";
import { UploadArtworkForm } from "./upload-artwork-form";

export default async function UploadPage() {
  await requireAdmin();

  return (
    <>
      <ViewHeader
        kanji="投稿"
        eyebrow="Nueva obra"
        title="Subir a la galería"
        description="Elegí la imagen, el tipo y el rating. Queda como borrador hasta que la publiques desde Galería. El original nunca sale de la zona privada."
      />
      <Panel className="max-w-2xl">
        <PanelHeader
          title="Datos de la obra"
          description="Se genera una miniatura, una preview con marca de agua y un placeholder."
        />
        <UploadArtworkForm />
      </Panel>
    </>
  );
}
