import type { Metadata } from "next";
import { requireAdminPage } from "@/auth";
import { body, brush, display, mono } from "@/app/g/fonts";
import { AdminNav, AdminTopbar } from "@/components/admin/admin-nav";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Panel · NightDaro", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The middleware only checks the token; this also checks the admin is active and their
  // password is not temporary.
  const admin = await requireAdminPage();

  return (
    <div
      className={`${display.variable} ${body.variable} ${brush.variable} ${mono.variable} grid min-h-dvh font-jp md:grid-cols-[240px_minmax(0,1fr)]`}
    >
      <aside className="flex min-w-0 flex-col gap-5 border-b-[3px] border-black bg-gradient-to-b from-[#150b42] to-[#07041a] p-4 shadow-[0_4px_0_var(--brand-violet)] md:sticky md:top-0 md:h-dvh md:border-r-[3px] md:border-b-0 md:shadow-[4px_0_0_var(--brand-violet)]">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimization needed */}
          <img
            src="/brand/dragon.svg"
            alt=""
            width={52}
            height={52}
            className="size-[52px] flex-none rounded-[7px] border-[3px] border-black bg-[#07041a] p-1 shadow-[3px_3px_0_#000]"
          />
          <div>
            <p className="font-display text-lg leading-none whitespace-nowrap">
              NIGHT<b className="font-normal text-brand-violet">DARO</b>
            </p>
            <span
              aria-hidden
              className="mt-1 block font-brush text-[13px] tracking-[0.4em] text-brand-green [text-shadow:0_0_10px_#39ff8877]"
            >
              ナイトダロ
            </span>
            <p className="mt-0.5 font-label text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              Estudio · admin
            </p>
          </div>
        </div>
        <nav aria-label="Panel">
          <AdminNav />
        </nav>
        <div className="flex flex-col gap-3 md:mt-auto">
          <div className="hidden items-center gap-2.5 rounded-sm border-2 border-black bg-card p-2.5 shadow-[3px_3px_0_#000] md:flex">
            <span
              aria-hidden
              className="size-[34px] flex-none rounded-full border-2 border-black bg-[radial-gradient(circle_at_35%_35%,#ff4fd8,var(--brand-violet)_55%,#150b42)]"
            />
            <div className="min-w-0">
              <b className="block truncate text-[13px]">{admin.username}</b>
              <small className="font-label text-[10px] text-brand-green">
                ● {admin.role === "owner" ? "dueño" : "admin"}
              </small>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-full border-[1.5px] border-border px-4 py-2 text-sm font-bold hover:border-brand-sky"
            >
              Salir
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 pb-16">
        <AdminTopbar />
        <div className="max-w-[1240px] px-4 pt-6 md:px-6">{children}</div>
      </main>
    </div>
  );
}
