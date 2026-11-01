import { z } from "zod";
import { TIER_PLATFORMS } from "./tier";

export const MAX_BENEFITS = 6;
export const MAX_BENEFIT_LENGTH = 80;

export const httpsUrlSchema = z.url({ protocol: /^https$/, error: "Usá un link https://" });

export const tierFieldsSchema = z.object({
  platform: z.enum(TIER_PLATFORMS),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  priceCents: z.number().int().min(0).max(1_000_000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Código de 3 letras, ej. USD")
    .default("USD"),
  url: httpsUrlSchema,
  benefits: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Un beneficio no puede estar vacío")
        .max(MAX_BENEFIT_LENGTH, `Hasta ${MAX_BENEFIT_LENGTH} caracteres por beneficio`),
    )
    .max(MAX_BENEFITS, `Hasta ${MAX_BENEFITS} beneficios`)
    .default([]),
  highlighted: z.boolean().default(false),
});

export const CODE_PATTERN = /^[a-z0-9-]{3,32}$/;

export const trackingLinkFieldsSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(CODE_PATTERN, "Entre 3 y 32 letras minúsculas, números o guiones")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  label: z.string().trim().min(1, "La etiqueta es obligatoria").max(80),
  targetUrl: httpsUrlSchema,
  tierId: z.uuid().nullable().default(null),
});

export const linkIdSchema = z.object({ id: z.uuid() });
