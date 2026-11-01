import { cookies } from "next/headers";
import { ConflictError } from "@/core/shared/errors";
import { container } from "@/infra/container";
import { adminRoute } from "../../admin/admin-route";
import { PATREON_STATE_COOKIE, patreonStateCookieOptions } from "../state-cookie";

const back = (request: Request, result: string) =>
  new Response(null, {
    status: 303,
    headers: {
      Location: new URL(`/admin/links?patreon=${result}`, request.url).href,
      "Cache-Control": "no-store",
    },
  });

/**
 * Patreon sends Daro back here with ?code&state. Admin only, and the state must match the one
 * this browser got from /api/admin/patreon/connect; the cookie is single use.
 */
export const GET = adminRoute(async (request) => {
  const patreon = container.patreon;
  if (!patreon) return back(request, "sin-configurar");
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const expectedState = jar.get(PATREON_STATE_COOKIE)?.value;
  jar.delete({ name: PATREON_STATE_COOKIE, path: patreonStateCookieOptions.path });

  const code = params.get("code");
  const state = params.get("state");
  // Daro cancelled on Patreon, or the request is not a Patreon redirect.
  if (params.get("error") || !code || !state) return back(request, "cancelado");

  try {
    await patreon.complete.execute({ code, state, expectedState });
  } catch (error) {
    if (error instanceof ConflictError) return back(request, "vencido");
    console.error("Patreon connection failed", error);
    return back(request, "error");
  }
  try {
    // Tiers, links, webhook and members. The connection stays even if this fails;
    // connecting again retries it.
    await patreon.setUp.execute();
  } catch (error) {
    console.error("Patreon set-up failed", error);
    return back(request, "incompleto");
  }
  return back(request, "conectado");
});
