"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Tier } from "@/core/links/tier";
import type { TrackingLink } from "@/core/links/tracking-link";
import { CODE_PATTERN, httpsUrlSchema } from "@/core/links/link-schemas";
import { applyFieldErrors } from "@/components/admin/apply-field-errors";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTrackingLinkAction,
  deleteTrackingLinkAction,
  updateTrackingLinkAction,
} from "./actions";

const formSchema = z.object({
  label: z.string().trim().min(1, "La etiqueta es obligatoria").max(80),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .refine((code) => code === "" || CODE_PATTERN.test(code), {
      error: "Entre 3 y 32 letras minúsculas, números o guiones",
    }),
  targetUrl: httpsUrlSchema,
  /** "" means no tier. */
  tierId: z.string(),
});
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = { label: "", code: "", targetUrl: "", tierId: "" };

/** Edits an existing tracking link, or adds a new one when `link` is not given. */
export function TrackingLinkEditor({ link, tiers }: { link?: TrackingLink; tiers: Tier[] }) {
  const [error, setError] = useState<string>();
  const [deleting, startDelete] = useTransition();
  const id = (name: string) => `link-${link?.id ?? "new"}-${name}`;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: link
      ? { label: link.label, code: link.code, targetUrl: link.targetUrl, tierId: link.tierId ?? "" }
      : emptyValues,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const submit = handleSubmit(async (values) => {
    setError(undefined);
    const input = { ...values, tierId: values.tierId || null };
    const result = link
      ? await updateTrackingLinkAction({ id: link.id, ...input })
      : await createTrackingLinkAction(input);
    if (!result.ok) {
      setError(result.error);
      applyFieldErrors(form.setError, result.fieldErrors);
      return;
    }
    form.reset(link ? undefined : emptyValues, { keepValues: !!link });
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      data-testid={link ? "tracking-link" : "new-tracking-link"}
      className="grid gap-3 rounded-sm border-2 border-border bg-background p-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-sm">{link ? link.label : "Agregar link"}</b>
        {link && <code className="font-mono text-xs text-brand-sky">/r/{link.code}</code>}
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
        <FormField id={id("label")} label="Etiqueta" error={errors.label?.message}>
          <Input id={id("label")} aria-invalid={!!errors.label} {...register("label")} />
        </FormField>
        <FormField
          id={id("code")}
          label="Código"
          hint={link ? undefined : " · Vacío = automático"}
          error={errors.code?.message}
        >
          <Input id={id("code")} aria-invalid={!!errors.code} {...register("code")} />
        </FormField>
        <FormField id={id("tierId")} label="Tier">
          <select id={id("tierId")} className={selectClassName} {...register("tierId")}>
            <option value="">Sin tier (red social u otro)</option>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField id={id("targetUrl")} label="Destino" error={errors.targetUrl?.message}>
        <Input
          id={id("targetUrl")}
          type="url"
          placeholder="https://…"
          aria-invalid={!!errors.targetUrl}
          {...register("targetUrl")}
        />
      </FormField>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {link && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={deleting}
            onClick={() => {
              if (!confirm(`¿Borrar el link "${link.label}"?`)) return;
              startDelete(async () => {
                const result = await deleteTrackingLinkAction({ id: link.id });
                if (!result.ok) setError(result.error);
              });
            }}
          >
            Borrar
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isSubmitting || (!!link && !isDirty)}>
          {link ? "Guardar" : "Agregar"}
        </Button>
      </div>
    </form>
  );
}
