"use client";

import { useEffect, useState } from "react";
import { messages, type Locale } from "./i18n";

/**
 * Blurs the protected art while the window is not focused or the tab is hidden, which defeats
 * many capture tools that steal focus. A deterrent, not a guarantee. Focus moving into an iframe
 * of the page itself (the timelapse player, on play) also fires `blur`, and is not shielded.
 */
export function ProtectionShield({ locale }: { locale: Locale }) {
  const [shielded, setShielded] = useState(false);

  useEffect(() => {
    // The browser sets activeElement to the iframe right after the window's blur.
    const on = () =>
      setTimeout(() => setShielded(!(document.activeElement instanceof HTMLIFrameElement)), 0);
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
        {messages[locale].shield}
      </div>
    </div>
  );
}
