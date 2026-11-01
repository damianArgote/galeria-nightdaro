"use client";

import { useEffect, useState } from "react";

/**
 * Blurs the protected art while the window is not focused or the tab is hidden, which defeats
 * many capture tools that steal focus. A deterrent, not a guarantee.
 */
export function ProtectionShield() {
  const [shielded, setShielded] = useState(false);

  useEffect(() => {
    const on = () => setShielded(true);
    const off = () => setShielded(false);
    const visibility = () => setShielded(document.hidden);
    window.addEventListener("blur", on);
    window.addEventListener("focus", off);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", on);
      window.removeEventListener("focus", off);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("shielded", shielded);
  }, [shielded]);

  if (!shielded) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-0 z-[70] grid place-items-center">
      <div className="rounded-xl border border-brand-violet bg-black px-5 py-3.5 font-label text-[13px]">
        Contenido protegido · volvé a la ventana
      </div>
    </div>
  );
}
