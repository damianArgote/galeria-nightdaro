"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/subir", label: "Subir" },
  { href: "/admin/galeria", label: "Galería" },
  { href: "/admin/pagina", label: "Página" },
  { href: "/admin/links", label: "Links" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <ul className="flex flex-row gap-1 md:flex-col">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent",
                active && "bg-sidebar-accent font-semibold text-brand-green",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
