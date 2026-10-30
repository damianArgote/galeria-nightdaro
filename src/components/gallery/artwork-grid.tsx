"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PublicArtwork } from "@/core/gallery/public-gallery";
import { cn } from "@/lib/utils";

const NUMERALS = "一二三四五六七八九十";

/** Stable media URLs; /media signs a fresh URL on every request (see its route). */
export const mediaUrl = (id: string, variant: "thumb" | "preview" | "player") =>
  `/media/${id}/${variant}`;

function Badge({ artwork }: { artwork: PublicArtwork }) {
  const [label, tone] =
    artwork.rating === "explicit"
      ? ["+18 · Solo en Patreon", "bg-brand-violet text-[#12002a]"]
      : artwork.rating === "suggestive"
        ? ["+18", "bg-brand-hanko text-[#2a0020]"]
        : artwork.kind === "wip"
          ? ["En proceso", "bg-brand-sky text-[#00222a]"]
          : ["Público", "bg-brand-green text-[#04210c]"];
  return (
    <span
      className={cn(
        "absolute top-2.5 left-2.5 z-[2] rounded-full px-2.5 py-1 font-label text-[11px] tracking-[0.04em]",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function Lock({ big = false }: { big?: boolean }) {
  return (
    <div className="absolute inset-0 grid place-content-center place-items-center gap-2 bg-gradient-to-b from-[#07091a]/10 to-[#07091a]/80 p-3.5 text-center">
      <strong
        className={cn(
          "font-brush text-white [text-shadow:3px_3px_0_var(--color-brand-hanko)]",
          big ? "text-3xl" : "text-2xl",
        )}
      >
        十八禁
      </strong>
      <small className="text-[13px] text-[#e8e2ff]">Versión censurada · completa en Patreon</small>
    </div>
  );
}

/** Image with its blurred placeholder underneath; no drag, no context menu. */
function ProtectedImage({
  artwork,
  variant,
  className,
}: {
  artwork: PublicArtwork;
  variant: "thumb" | "preview";
  className?: string;
}) {
  if (!artwork.image) {
    return (
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-[radial-gradient(60%_45%_at_40%_40%,var(--brand-violet),transparent_70%),radial-gradient(50%_40%_at_60%_80%,var(--brand-sky),transparent_70%),linear-gradient(160deg,#150b42,#07041a)]",
          className,
        )}
      />
    );
  }
  return (
    <div
      className={cn("absolute inset-0 bg-cover bg-center", className)}
      style={
        artwork.image.blurData ? { backgroundImage: `url(${artwork.image.blurData})` } : undefined
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed CDN redirect, already resized */}
      <img
        src={mediaUrl(artwork.id, variant)}
        alt={artwork.title}
        width={artwork.image.width ?? undefined}
        height={artwork.image.height ?? undefined}
        loading="lazy"
        draggable={false}
        onContextMenu={(event) => event.preventDefault()}
        className="size-full object-cover select-none [-webkit-touch-callout:none]"
        data-testid="artwork-image"
      />
    </div>
  );
}

export function ArtworkGrid({ artworks }: { artworks: PublicArtwork[] }) {
  const [open, setOpen] = useState<PublicArtwork | null>(null);

  if (artworks.length === 0) {
    return (
      <p className="rounded-md border-2 border-dashed border-[#2e2470] p-10 text-center text-[#aaa4d8]">
        <span aria-hidden className="block font-brush text-3xl text-paper/50">
          空
        </span>
        Todavía no hay obras en esta pestaña.
      </p>
    );
  }

  return (
    <>
      <ul
        className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[22px]"
        onContextMenu={(event) => event.preventDefault()}
      >
        {artworks.map((artwork, index) => (
          <li key={artwork.id} data-testid="gallery-card" data-rating={artwork.rating}>
            <button
              type="button"
              onClick={() => setOpen(artwork)}
              className="group flex w-full flex-col overflow-hidden rounded-sm border-[3px] border-black bg-[#120c33] text-left shadow-[5px_5px_0_#000] transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_var(--brand-violet)]"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <ProtectedImage
                  artwork={artwork}
                  variant="thumb"
                  className="transition-transform duration-500 group-hover:scale-105"
                />
                <span
                  aria-hidden
                  className="absolute top-2.5 right-2.5 z-[2] border-2 border-black bg-white px-[3px] py-1.5 font-brush text-[15px] text-black [writing-mode:vertical-rl]"
                >
                  第{NUMERALS[index % 10]}話
                </span>
                {artwork.kind === "timelapse" && (
                  <span aria-hidden className="absolute inset-0 grid place-items-center">
                    <span className="grid size-14 place-items-center rounded-full border-2 border-paper bg-black/60">
                      ▶
                    </span>
                  </span>
                )}
                {artwork.rating === "explicit" && <Lock />}
                <Badge artwork={artwork} />
              </div>
              <div className="flex flex-col gap-0.5 border-t-[3px] border-black px-3.5 pt-3 pb-3.5">
                <h3 className="text-base font-bold">{artwork.title}</h3>
                {artwork.description && (
                  <p className="m-0 text-[13px] text-[#aaa4d8]">{artwork.description}</p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {open && <Lightbox artwork={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ artwork, onClose }: { artwork: PublicArtwork; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kind =
    artwork.rating === "explicit"
      ? "+18 · Exclusivo de Patreon"
      : artwork.kind === "timelapse"
        ? "Timelapse"
        : "Vista previa · baja resolución";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="fixed inset-0 z-[80] grid place-items-center bg-[#04061a]/80 px-4 py-6 backdrop-blur-xl"
    >
      <div className="max-h-[calc(100dvh-48px)] w-full max-w-[560px] overflow-y-auto rounded-md border-2 border-black bg-[#120c33] p-6 shadow-[10px_10px_0_var(--brand-violet)]">
        <button
          ref={close}
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="float-right text-2xl leading-none text-[#aaa4d8]"
        >
          ×
        </button>
        <p className="font-label text-xs tracking-[0.14em] text-brand-green uppercase">{kind}</p>
        <h2 id="lightbox-title" className="mt-1.5 mb-3.5 font-display text-[28px] leading-tight">
          {artwork.title}
        </h2>
        <div
          className="relative mb-4 aspect-[4/5] overflow-hidden rounded-xl border-2 border-black"
          onContextMenu={(event) => event.preventDefault()}
        >
          {artwork.kind === "timelapse" && artwork.hasVideo ? (
            <iframe
              src={mediaUrl(artwork.id, "player")}
              title={artwork.title}
              allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen"
              className="absolute inset-0 size-full"
            />
          ) : (
            <ProtectedImage artwork={artwork} variant="preview" />
          )}
          {artwork.rating === "explicit" && <Lock big />}
        </div>
        <p className="mb-4 text-[#aaa4d8]">
          {artwork.rating === "explicit"
            ? "Esta pieza no se publica completa en la web. En Patreon la ves sin censura y en alta resolución."
            : "Vista en baja resolución con marca de agua. La versión en alta y sin marca está en Patreon."}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/apoyar" className="gallery-cta px-5 py-3">
            Ver completo en Patreon
          </Link>
          <Link
            href={`/obra/${artwork.slug}`}
            className="rounded-full border-[1.5px] border-[#2e2470] px-5 py-3 font-bold text-paper"
          >
            Ficha de la obra
          </Link>
        </div>
      </div>
    </div>
  );
}
