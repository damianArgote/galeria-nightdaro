import { notFound } from "next/navigation";
import { requireAdminPage } from "@/auth";
import { Panel, PanelHeader, ViewHeader } from "@/components/admin/panel";
import { container } from "@/infra/container";
import { AdminsManager } from "./admins-manager";

/** Owner only; other admins do not even learn the page exists. */
export default async function UsersPage() {
  const admin = await requireAdminPage();
  if (admin.role !== "owner") notFound();
  const admins = await container.listAdmins.execute();

  return (
    <>
      <ViewHeader
        kanji="仲間"
        eyebrow="Solo el dueño"
        title="Usuarios"
        description="Quién puede entrar al panel. Cada admin nuevo recibe una contraseña temporal y elige la suya al entrar por primera vez."
      />
      <Panel className="max-w-3xl">
        <PanelHeader
          title="Admins"
          description="Desactivar o resetear la contraseña cierra las sesiones de ese admin al instante."
        />
        <AdminsManager admins={admins} currentId={admin.id} />
      </Panel>
    </>
  );
}
