"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { acceptAgeGate } from "@/app/g/actions";

/** Shown to visitors without the age_ok cookie. Accepting switches to the adult variant. */
export function AgeGate() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const enter = useRef<HTMLButtonElement>(null);

  useEffect(() => enter.current?.focus(), []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[80] grid place-items-center bg-[#04061a]/80 px-4 py-6 backdrop-blur-xl"
    >
      <div className="w-full max-w-[460px] rounded-md border-2 border-black bg-[#120c33] p-7 text-center shadow-[10px_10px_0_var(--brand-violet)]">
        <div className="flex items-center justify-center gap-4" aria-hidden>
          <span className="font-brush text-7xl leading-none text-brand-hanko [text-shadow:4px_4px_0_#000]">
            十八禁
          </span>
          <span className="grid size-16 -rotate-8 place-items-center rounded-full border-[3px] border-brand-hanko font-brush text-xl text-brand-hanko [writing-mode:vertical-rl]">
            成人
          </span>
        </div>
        <h2 id="age-gate-title" className="mt-3 mb-3 font-display text-3xl leading-tight">
          Contenido para adultos <span className="text-brand-violet">+18</span>
        </h2>
        <p className="mb-5 text-[#cfd3ea]">
          Esta galería tiene ilustraciones anime y fantasía con desnudos y temática sexual. Todos
          los personajes son adultos. Para entrar confirmá que tenés 18 años o más y que es legal
          ver este contenido donde vivís.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button
            ref={enter}
            type="button"
            disabled={pending}
            className="rounded-full bg-brand-violet px-5 py-3 font-bold text-[#12002a]"
            onClick={() =>
              startTransition(async () => {
                await acceptAgeGate();
                router.refresh();
              })
            }
          >
            Tengo 18 o más, entrar
          </button>
          <a
            href="https://www.google.com"
            rel="noopener noreferrer"
            className="rounded-full border-[1.5px] border-[#2e2470] px-5 py-3 font-bold text-paper"
          >
            Salir
          </a>
        </div>
      </div>
    </div>
  );
}
