import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/auth";
import { MustChangePasswordError } from "@/infra/auth/require-admin";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · NightDaro", robots: { index: false } };

const NOTICES: Record<string, string> = {
  "clave-cambiada": "Contraseña cambiada. Entrá con la nueva.",
};

/** A valid session goes to the panel; a stale one (disabled, reset) stays here to log in again. */
async function currentSession(): Promise<"active" | "temporary" | "none"> {
  try {
    await requireAdmin();
    return "active";
  } catch (error) {
    return error instanceof MustChangePasswordError ? "temporary" : "none";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const session = await currentSession();
  if (session === "active") redirect("/admin");
  if (session === "temporary") redirect("/cambiar-clave");
  const notice = NOTICES[(await searchParams).aviso ?? ""];

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-[0_0_40px_-12px_var(--brand-violet)]">
        <h1 className="mb-1 text-3xl font-black tracking-tight text-primary">NightDaro</h1>
        <p className="mb-6 text-sm text-brand-sky">Panel de administración</p>
        {notice && (
          <p role="status" className="mb-4 text-sm text-brand-green">
            {notice}
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
