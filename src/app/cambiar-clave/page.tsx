import type { Metadata } from "next";
import { requireAdminPage } from "@/auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Cambiar contraseña · NightDaro",
  robots: { index: false },
};

/** Open with a temporary password (the panel stays locked until it is changed) or by choice. */
export default async function ChangePasswordPage() {
  const admin = await requireAdminPage({ allowTemporaryPassword: true });

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-[0_0_40px_-12px_var(--brand-violet)]">
        <h1 className="mb-1 text-2xl font-black tracking-tight text-primary">
          {admin.mustChangePassword ? "Elegí tu contraseña" : "Cambiar contraseña"}
        </h1>
        <p className="mb-6 text-sm text-brand-sky">
          {admin.mustChangePassword
            ? `Hola, ${admin.username}. Entraste con una contraseña temporal: elegí la tuya para usar el panel.`
            : `Sesión de ${admin.username}. Al guardar se cierran todas tus sesiones.`}
        </p>
        <ChangePasswordForm temporary={admin.mustChangePassword} />
      </div>
    </main>
  );
}
