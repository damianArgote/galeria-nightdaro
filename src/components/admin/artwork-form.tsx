"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ActionResult } from "@/app/admin/_lib/action-result";
import { ARTWORK_KINDS, ARTWORK_RATINGS, type Artwork } from "@/core/artworks/artwork";
import { artworkFieldsSchema } from "@/core/artworks/artwork-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { applyFieldErrors } from "./apply-field-errors";
import { KIND_LABELS, RATING_LABELS } from "./artwork-labels";
import { FormField } from "./form-field";

const formSchema = z.object({
  title: artworkFieldsSchema.shape.title,
  description: z.string().max(500),
  kind: z.enum(ARTWORK_KINDS),
  rating: z.enum(ARTWORK_RATINGS, { error: "Elegí un rating" }),
  /** Comma-separated in the form, an array for the use case. */
  tags: z.string().max(800),
});
type FormValues = z.input<typeof formSchema>;

export interface ArtworkFormValues {
  title: string;
  description: string | null;
  kind: Artwork["kind"];
  rating: Artwork["rating"];
  tags: string[];
}

export function ArtworkForm({
  artwork,
  submitLabel,
  onSubmit,
  onCancel,
  idPrefix = "artwork",
}: {
  artwork?: Pick<Artwork, "title" | "description" | "kind" | "rating" | "tags">;
  submitLabel: string;
  onSubmit: (values: ArtworkFormValues) => Promise<ActionResult<unknown>>;
  onCancel?: () => void;
  idPrefix?: string;
}) {
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: artwork?.title ?? "",
      description: artwork?.description ?? "",
      kind: artwork?.kind ?? "finished",
      rating: artwork?.rating,
      tags: artwork?.tags.join(", ") ?? "",
    },
  });

  const timelapse = watch("kind") === "timelapse";

  const submit = handleSubmit(async (values) => {
    setFormError(undefined);
    const result = await onSubmit({
      title: values.title,
      description: values.description || null,
      kind: values.kind,
      rating: values.rating,
      tags: values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    if (!result.ok) {
      setFormError(result.error);
      applyFieldErrors(setError, result.fieldErrors);
    }
  });

  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormField id={id("title")} label="Título" error={errors.title?.message}>
        <Input id={id("title")} aria-invalid={!!errors.title} {...register("title")} />
      </FormField>
      <FormField
        id={id("description")}
        label="Descripción"
        hint=" · Opcional, se ve debajo de la obra."
        error={errors.description?.message}
      >
        <Textarea id={id("description")} rows={2} {...register("description")} />
      </FormField>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-bold">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {ARTWORK_KINDS.map((kind) => (
            <label
              key={kind}
              className="cursor-pointer rounded-sm border-2 border-border px-3 py-1.5 text-sm font-bold has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2"
            >
              <input type="radio" value={kind} className="sr-only" {...register("kind")} />
              {KIND_LABELS[kind].label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-bold">Rating</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ARTWORK_RATINGS.map((rating) => (
            <label
              key={rating}
              className={cn(
                "cursor-pointer rounded-md border-[3px] border-border bg-background p-3 has-focus-visible:outline-2 has-disabled:cursor-not-allowed has-disabled:opacity-50",
                "has-checked:border-black has-checked:bg-card has-checked:shadow-[4px_4px_0_var(--brand-green)]",
              )}
            >
              <input
                type="radio"
                value={rating}
                className="sr-only"
                disabled={timelapse && rating === "explicit"}
                {...register("rating")}
              />
              <b className="block text-sm">{RATING_LABELS[rating].label}</b>
              <span className="text-xs text-muted-foreground">
                {timelapse && rating === "explicit"
                  ? "No disponible para timelapses: los videos no se censuran."
                  : RATING_LABELS[rating].description}
              </span>
            </label>
          ))}
        </div>
        {errors.rating && <p className="text-xs text-destructive">{errors.rating.message}</p>}
      </fieldset>

      <FormField
        id={id("tags")}
        label="Etiquetas"
        hint=" · Separadas por coma."
        error={errors.tags?.message}
      >
        <Input id={id("tags")} {...register("tags")} />
      </FormField>

      {formError && (
        <p className="text-sm text-destructive" data-testid="form-error">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
