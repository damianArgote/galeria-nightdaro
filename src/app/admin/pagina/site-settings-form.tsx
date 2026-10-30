"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import {
  SOCIAL_NETWORKS,
  THEME_ACCENTS,
  type SiteSettings,
  type SocialNetwork,
  type ThemeAccent,
} from "@/core/site/site-settings";
import { updateSiteSettingsSchema } from "@/core/site/update-site-settings";
import { applyFieldErrors } from "@/components/admin/apply-field-errors";
import { FormField } from "@/components/admin/form-field";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateSiteSettingsAction } from "./actions";

type FormValues = z.input<typeof updateSiteSettingsSchema>;

const ACCENTS: Record<ThemeAccent, { label: string; swatch: string }> = {
  violet: { label: "Violeta neón", swatch: "bg-brand-violet" },
  sky: { label: "Celeste", swatch: "bg-brand-sky" },
  green: { label: "Verde", swatch: "bg-brand-green" },
};

const NETWORKS: Record<SocialNetwork, { short: string; label: string; placeholder: string }> = {
  instagram: {
    short: "IG",
    label: "Instagram",
    placeholder: "https://www.instagram.com/usuario",
  },
  x: { short: "X", label: "X", placeholder: "https://x.com/usuario" },
  facebook: { short: "FB", label: "Facebook", placeholder: "https://www.facebook.com/usuario" },
  tiktok: { short: "TT", label: "TikTok", placeholder: "https://www.tiktok.com/@usuario" },
};

export function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const [status, setStatus] = useState<{ ok: boolean; message: string }>();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(updateSiteSettingsSchema),
    defaultValues: toFormValues(settings),
  });

  const submit = handleSubmit(async (values) => {
    setStatus(undefined);
    const result = await updateSiteSettingsAction(values);
    if (result.ok) {
      // Keep what is on screen as the new clean state.
      reset(undefined, { keepValues: true });
      setStatus({ ok: true, message: "Cambios guardados." });
    } else {
      setStatus({ ok: false, message: result.error });
      applyFieldErrors(setError, result.fieldErrors);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid max-w-3xl gap-6">
      <Panel>
        <PanelHeader
          title="Banner y textos"
          description="El banner se sube junto con las imágenes, en el próximo paso."
        />
        <div
          aria-hidden
          className="mb-5 grid aspect-[1600/685] place-items-center rounded-sm border-[3px] border-black bg-[radial-gradient(60%_80%_at_72%_45%,#3a1a8f,transparent_70%),linear-gradient(180deg,var(--card),var(--background))] shadow-[5px_5px_0_#000]"
        >
          <span className="text-4xl font-black [text-shadow:3px_3px_0_var(--brand-violet),6px_6px_0_var(--brand-sky)]">
            {settings.name.toUpperCase()}
          </span>
        </div>
        <div className="grid gap-4">
          <FormField id="site-name" label="Nombre" error={errors.name?.message}>
            <Input id="site-name" aria-invalid={!!errors.name} {...register("name")} />
          </FormField>
          <FormField id="site-bio" label="Texto de presentación" error={errors.bio?.message}>
            <Textarea id="site-bio" rows={4} {...register("bio")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="site-seo-title"
              label="Título para buscadores y redes"
              error={errors.seo?.title?.message}
            >
              <Input id="site-seo-title" {...register("seo.title")} />
            </FormField>
            <FormField
              id="site-seo-description"
              label="Descripción para buscadores y redes"
              error={errors.seo?.description?.message}
            >
              <Input id="site-seo-description" {...register("seo.description")} />
            </FormField>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Tema" description="Color de acento de la página pública." />
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Color de acento</legend>
          {THEME_ACCENTS.map((accent) => (
            <label
              key={accent}
              className="flex cursor-pointer items-center gap-2 rounded-sm border-2 border-border bg-background px-3 py-2 text-sm font-bold has-checked:border-foreground has-focus-visible:outline-2"
            >
              <input
                type="radio"
                value={accent}
                className="sr-only"
                {...register("theme.accent")}
              />
              <span
                className={`size-4 rounded-full border-2 border-black ${ACCENTS[accent].swatch}`}
              />
              {ACCENTS[accent].label}
            </label>
          ))}
        </fieldset>
      </Panel>

      <Panel>
        <PanelHeader title="Puerta +18" description="Se aplica a toda la página." />
        <div className="flex items-center justify-between gap-3 rounded-sm border-2 border-border bg-background p-3">
          <div>
            <b id="age-gate-label" className="block text-sm">
              Pedir confirmación de edad
            </b>
            <span className="text-xs text-muted-foreground">
              Sin aceptarla, la galería solo muestra obras aptas para todos.
            </span>
          </div>
          <Controller
            control={control}
            name="ageGateEnabled"
            render={({ field }) => (
              <Switch
                aria-labelledby="age-gate-label"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Redes" description="Aparecen en el pie de la página. Links https://" />
        <div className="grid gap-3">
          {SOCIAL_NETWORKS.map((network) => (
            <div key={network} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2.5">
              <span
                aria-hidden
                className="rounded-sm border-2 border-border py-1 text-center font-mono text-xs text-muted-foreground"
              >
                {NETWORKS[network].short}
              </span>
              <div>
                <Input
                  aria-label={NETWORKS[network].label}
                  placeholder={NETWORKS[network].placeholder}
                  className="placeholder:text-muted-foreground/45"
                  aria-invalid={!!errors.socials?.[network]}
                  {...register(`socials.${network}`)}
                />
                {errors.socials?.[network] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.socials[network]?.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {status && (
          <p
            role="status"
            className={status.ok ? "text-sm text-brand-green" : "text-sm text-destructive"}
          >
            {status.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function toFormValues(settings: SiteSettings): FormValues {
  return {
    name: settings.name,
    bio: settings.bio ?? "",
    theme: { accent: settings.theme.accent },
    ageGateEnabled: settings.ageGateEnabled,
    socials: Object.fromEntries(
      SOCIAL_NETWORKS.map((network) => [network, settings.socials[network] ?? ""]),
    ),
    seo: { title: settings.seo.title ?? "", description: settings.seo.description ?? "" },
  };
}
