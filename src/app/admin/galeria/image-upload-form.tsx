"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { Artwork } from "@/core/artworks/artwork";
import { Button } from "@/components/ui/button";
import { uploadImage } from "../_lib/upload-image";

const ACCEPT = "image/jpeg,image/png,image/webp";

/** Adds or replaces the image of an artwork from its row: drafts from Patreon, covers, fixes. */
export function ImageUploadForm({
  artwork,
  onDone,
}: {
  artwork: Pick<Artwork, "id" | "kind" | "rating" | "title">;
  onDone: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [image, setImage] = useState<File>();
  const [censored, setCensored] = useState<File>();
  const [adults, setAdults] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const explicit = artwork.rating === "explicit";
  const label = artwork.kind === "timelapse" ? "Portada" : "Imagen";

  return (
    <form
      data-testid="image-upload-form"
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!image) return setError("Elegí una imagen.");
        if (!adults) return setError("Confirmá que todos los personajes son adultos.");
        startTransition(async () => {
          setError(undefined);
          const result = await uploadImage(artwork.id, {
            image,
            censored: explicit ? censored : undefined,
          });
          if (!result.ok) return setError(result.error);
          router.refresh();
          onDone();
        });
      }}
    >
      <div className="grid gap-1">
        <label htmlFor={`${id}-image`} className="text-sm font-bold">
          {label}
        </label>
        <input
          id={`${id}-image`}
          type="file"
          accept={ACCEPT}
          aria-describedby={`${id}-image-hint`}
          className="text-sm"
          onChange={(event) => setImage(event.target.files?.[0])}
        />
        <p id={`${id}-image-hint`} className="text-xs text-muted-foreground">
          JPG, PNG o WebP · hasta 30 MB · reemplaza la anterior
        </p>
      </div>
      {explicit && (
        <div className="grid gap-1">
          <label htmlFor={`${id}-censored`} className="text-sm font-bold">
            Versión censurada
          </label>
          <input
            id={`${id}-censored`}
            type="file"
            accept={ACCEPT}
            aria-describedby={`${id}-censored-hint`}
            className="text-sm"
            onChange={(event) => setCensored(event.target.files?.[0])}
          />
          <p id={`${id}-censored-hint`} className="text-xs text-muted-foreground">
            Opcional. Es la que muestra la web; sin ella, la imagen sale con un desenfoque fuerte.
          </p>
        </div>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-brand-violet"
          checked={adults}
          onChange={(event) => setAdults(event.target.checked)}
        />
        Todos los personajes son adultos
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Subiendo…" : `Subir ${label.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
