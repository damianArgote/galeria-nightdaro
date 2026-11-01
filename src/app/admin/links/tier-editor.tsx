"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TIER_PLATFORMS, type Tier } from "@/core/links/tier";
import type { PatreonTier } from "@/core/patreon/patreon";
import { MAX_BENEFIT_LENGTH, MAX_BENEFITS, tierFieldsSchema } from "@/core/links/link-schemas";
import { applyFieldErrors } from "@/components/admin/apply-field-errors";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTierAction, deleteTierAction, updateTierAction } from "./actions";

const PLATFORM_LABELS: Record<Tier["platform"], string> = {
  patreon: "Patreon",
  onlyfans: "OnlyFans",
  fansly: "Fansly",
};

/** One benefit per line; blank lines are ignored. */
const benefitLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * The form edits the price in currency units (the use case stores cents) and the benefits as
 * one per line; the use case schema validates them again on the server.
 */
const formSchema = tierFieldsSchema
  .omit({ priceCents: true, currency: true, benefits: true, patreonTierId: true })
  .extend({
    /** "" means not linked. */
    patreonTierId: z.string(),
    price: z.number({ error: "Ingresá un precio" }).min(0).max(10_000),
    currency: z.string().trim(),
    benefitsText: z
      .string()
      .refine((text) => benefitLines(text).length <= MAX_BENEFITS, {
        error: `Hasta ${MAX_BENEFITS} beneficios`,
      })
      .refine((text) => benefitLines(text).every((line) => line.length <= MAX_BENEFIT_LENGTH), {
        error: `Hasta ${MAX_BENEFIT_LENGTH} caracteres por beneficio`,
      }),
  });
type FormValues = z.input<typeof formSchema>;

/** Edits an existing tier, or adds a new one when `tier` is not given. */
export function TierEditor({
  tier,
  patreonTiers = [],
}: {
  tier?: Tier;
  /** Daro's Patreon tiers, once Patreon is connected: the link can be fixed by hand. */
  patreonTiers?: PatreonTier[];
}) {
  const [error, setError] = useState<string>();
  const [deleting, startDelete] = useTransition();
  const id = (name: string) => `tier-${tier?.id ?? "new"}-${name}`;
  const emptyValues: FormValues = {
    platform: "patreon",
    name: "",
    price: 0,
    currency: "USD",
    url: "",
    benefitsText: "",
    highlighted: false,
    patreonTierId: "",
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
          benefitsText: tier.benefits.join("\n"),
          highlighted: tier.highlighted,
          patreonTierId: tier.patreonTierId ?? "",
        }
      : emptyValues,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const submit = handleSubmit(async ({ price, benefitsText, patreonTierId, ...values }) => {
    setError(undefined);
    const input = {
      ...values,
      priceCents: Math.round(price * 100),
      benefits: benefitLines(benefitsText),
      patreonTierId: patreonTierId || null,
    };
    const result = tier
      ? await updateTierAction({ id: tier.id, ...input })
      : await createTierAction(input);
    if (!result.ok) {
      setError(result.error);
      const { benefits, ...fieldErrors } = result.fieldErrors ?? {};
      applyFieldErrors(form.setError, { ...fieldErrors, benefitsText: benefits });
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
      <FormField
        id={id("benefits")}
        label={`Beneficios (uno por línea, hasta ${MAX_BENEFITS})`}
        error={errors.benefitsText?.message}
      >
        <Textarea
          id={id("benefits")}
          rows={4}
          placeholder={"Arte NSFW exclusivo\nAcceso anticipado"}
          aria-invalid={!!errors.benefitsText}
          {...register("benefitsText")}
        />
      </FormField>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          className="size-4 accent-brand-violet"
          {...register("highlighted")}
        />
        Destacar como «El más elegido»
        <span className="font-normal text-muted-foreground">
          (solo uno: marcar este desmarca el anterior)
        </span>
      </label>
      {patreonTiers.length > 0 && form.watch("platform") === "patreon" && (
        <FormField
          id={id("patreon-tier")}
          label="Tier de Patreon (para contar sus altas)"
          error={errors.patreonTierId?.message}
        >
          <select
            id={id("patreon-tier")}
            className={selectClassName}
            {...register("patreonTierId")}
          >
            <option value="">Sin vincular</option>
            {patreonTiers.map((patreonTier) => (
              <option key={patreonTier.id} value={patreonTier.id}>
                {patreonTier.title} · US${patreonTier.amountCents / 100}
              </option>
            ))}
          </select>
        </FormField>
      )}
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
