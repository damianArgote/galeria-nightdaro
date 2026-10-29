import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Panel · NightDaro", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The middleware already blocks /admin without a session; this is defense in depth.
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:w-56 md:border-r md:border-b-0">
        <p className="text-xl font-black text-primary">NightDaro</p>
        <nav aria-label="Panel" className="flex-1">
          <AdminNav />
        </nav>
        <div className="flex flex-col gap-2">
          <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
          <form action={logout}>
            <Button type="submit" variant="secondary" className="w-full">
              Salir
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
