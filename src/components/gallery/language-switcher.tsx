"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setGalleryLocale } from "@/app/g/actions";
import { cn } from "@/lib/utils";
import { LOCALES, messages, type Locale } from "./i18n";

/** EN / ES toggle of the public gallery: stores the lang cookie and reloads the current page. */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = messages[locale].languageSwitcher;

  return (
    <div
      role="group"
      aria-label={t.label}
      data-testid="language-switcher"
      className="flex rounded-full border-[1.5px] border-[#2e2470] p-0.5 font-label text-xs"
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-label={t.names[option]}
          aria-pressed={option === locale}
          disabled={pending}
          onClick={() => {
            if (option === locale) return;
            startTransition(async () => {
              await setGalleryLocale(option);
              router.refresh();
            });
          }}
          className={cn(
            "rounded-full px-2.5 py-1 text-[#aaa4d8] uppercase hover:text-paper",
            option === locale && "bg-paper text-[#07041a] hover:text-[#07041a]",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
