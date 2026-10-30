"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TIER_PLATFORMS, type Tier } from "@/core/links/tier";
import { tierFieldsSchema } from "@/core/links/link-schemas";
import { applyFieldErrors } from "@/components/admin/apply-field-errors";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTierAction, deleteTierAction, updateTierAction } from "./actions";

const PLATFORM_LABELS: Record<Tier["platform"], string> = {
  patreon: "Patreon",
  onlyfans: "OnlyFans",
  fansly: "Fansly",
};

/** The form edits the price in currency units; the use case stores cents. */
const formSchema = tierFieldsSchema.omit({ priceCents: true, currency: true }).extend({
  price: z.number({ error: "Ingresá un precio" }).min(0).max(10_000),
  currency: z.string().trim(),
});
type FormValues = z.input<typeof formSchema>;

/** Edits an existing tier, or adds a new one when `tier` is not given. */
export function TierEditor({ tier }: { tier?: Tier }) {
  const [error, setError] = useState<string>();
  const [deleting, startDelete] = useTransition();
  const id = (name: string) => `tier-${tier?.id ?? "new"}-${name}`;
  const emptyValues: FormValues = {
    platform: "patreon",
    name: "",
    price: 0,
    currency: "USD",
    url: "",
  };
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: tier
      ? {
          platform: tier.platform,
          name: tier.name,
          price: tier.priceCents / 100,
          currency: tier.currency,
          url: tier.url,
        }
      : emptyValues,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const submit = handleSubmit(async ({ price, ...values }) => {
    setError(undefined);
    const input = { ...values, priceCents: Math.round(price * 100) };
    const result = tier
      ? await updateTierAction({ id: tier.id, ...input })
      : await createTierAction(input);
    if (!result.ok) {
      setError(result.error);
      applyFieldErrors(form.setError, result.fieldErrors);
      return;
    }
    form.reset(tier ? undefined : emptyValues, { keepValues: !!tier });
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      data-testid={tier ? "tier" : "new-tier"}
      className="grid gap-3 rounded-sm border-2 border-border bg-background p-3.5"
    >
      {!tier && <b className="text-sm">Agregar tier</b>}
      <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)_110px_80px]">
        <FormField id={id("platform")} label="Plataforma">
          <select id={id("platform")} className={selectClassName} {...register("platform")}>
            {TIER_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {PLATFORM_LABELS[platform]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={id("name")} label="Nombre" error={errors.name?.message}>
          <Input id={id("name")} aria-invalid={!!errors.name} {...register("name")} />
        </FormField>
        <FormField id={id("price")} label="Precio" error={errors.price?.message}>
          <Input
            id={id("price")}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            aria-invalid={!!errors.price}
            {...register("price", { valueAsNumber: true })}
          />
        </FormField>
        <FormField id={id("currency")} label="Moneda" error={errors.currency?.message}>
          <Input id={id("currency")} maxLength={3} {...register("currency")} />
        </FormField>
      </div>
      <FormField id={id("url")} label="Link de suscripción" error={errors.url?.message}>
        <Input
          id={id("url")}
          type="url"
          placeholder="https://www.patreon.com/…"
          aria-invalid={!!errors.url}
          {...register("url")}
        />
      </FormField>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {tier && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={deleting}
            onClick={() => {
              if (!confirm(`¿Borrar el tier "${tier.name}"?`)) return;
              startDelete(async () => {
                const result = await deleteTierAction({ id: tier.id });
                if (!result.ok) setError(result.error);
              });
            }}
          >
            Borrar
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isSubmitting || (!!tier && !isDirty)}>
          {tier ? "Guardar" : "Agregar"}
        </Button>
      </div>
    </form>
  );
}
