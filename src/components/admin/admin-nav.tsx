"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AdminTour } from "./admin-tour";

export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Resumen", title: "Resumen", kanji: "概要" },
  { href: "/admin/subir", label: "Subir", title: "Subir contenido", kanji: "投稿" },
  { href: "/admin/galeria", label: "Galería", title: "Galería", kanji: "画廊" },
  { href: "/admin/pagina", label: "Página", title: "Página pública", kanji: "編集" },
  { href: "/admin/links", label: "Links", title: "Tiers y links", kanji: "支援" },
  { href: "/admin/usuarios", label: "Usuarios", title: "Usuarios", kanji: "仲間", ownerOnly: true },
] as const;

/** Sidebar menu of the studio mockup: brush kanji per section, active item on paper. */
export function AdminNav({ owner }: { owner: boolean }) {
  const pathname = usePathname();
  const sections = ADMIN_SECTIONS.filter((item) => owner || !("ownerOnly" in item));

  return (
    <ul className="flex flex-row gap-1.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
      {sections.map((item) => {
        const active = pathname === item.href;
        return (
          <li key={item.href} className="flex-none">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "grid grid-cols-[auto_1fr] items-center gap-2.5 rounded-sm border-2 border-transparent px-3 py-2 font-bold text-muted-foreground hover:border-border hover:text-foreground md:grid-cols-[40px_1fr]",
                active &&
                  "border-black bg-paper text-brand-ink shadow-[4px_4px_0_var(--brand-violet)] hover:text-brand-ink",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "text-center font-brush text-[17px] whitespace-nowrap",
                  active ? "text-brand-ink" : "text-foreground/70",
                )}
              >
                {item.kanji}
              </span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Sticky top bar: the section title, how changes are saved and the section's tutorial. */
export function AdminTopbar({ adminId }: { adminId: string }) {
  const pathname = usePathname();
  const section = ADMIN_SECTIONS.find((s) => s.href === pathname) ?? ADMIN_SECTIONS[0];

  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-brand-ink/90 px-4 py-3.5 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="font-display text-[clamp(22px,3vw,30px)] leading-tight">{section.title}</h1>
        <span className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:inline-flex">
          <i
            aria-hidden
            className="size-2 rounded-full bg-brand-green shadow-[0_0_8px_var(--brand-green)]"
          />
          Los cambios se guardan al instante
        </span>
      </div>
      <div className="flex items-center gap-2">
        <AdminTour adminId={adminId} />
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          data-tour="public-link"
          className="rounded-full border-[1.5px] border-border px-3 py-1.5 text-xs font-bold hover:border-brand-sky"
        >
          Ver página pública ↗
        </a>
      </div>
    </div>
  );
}
