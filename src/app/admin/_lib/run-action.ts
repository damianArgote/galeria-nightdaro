import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ConflictError, InvalidInputError, NotFoundError } from "@/core/shared/errors";
import type { ActionResult } from "./action-result";

/**
 * Validates untrusted Server Action input with the use case schema, runs the use case and
 * revalidates the whole site (public gallery and panel). Callers must run requireAdmin() first.
 * Business errors become a result the form can show; anything else is thrown.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  run: (input: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los campos marcados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const data = await run(parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ConflictError || error instanceof InvalidInputError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: error.field ? { [error.field]: [error.message] } : undefined,
      };
    }
    if (error instanceof NotFoundError) {
      return { ok: false, error: "Ya no existe. Recargá la página." };
    }
    throw error;
  }
}
