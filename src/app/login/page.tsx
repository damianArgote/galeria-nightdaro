import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · NightDaro", robots: { index: false } };

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/admin");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-[0_0_40px_-12px_var(--brand-violet)]">
        <h1 className="mb-1 text-3xl font-black tracking-tight text-primary">NightDaro</h1>
        <p className="mb-6 text-sm text-brand-sky">Panel de administración</p>
        <LoginForm />
      </div>
    </main>
  );
}
