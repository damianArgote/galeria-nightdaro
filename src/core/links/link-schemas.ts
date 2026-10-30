import { z } from "zod";
import { TIER_PLATFORMS } from "./tier";

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
