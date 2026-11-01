import { cookies } from "next/headers";
import { container } from "@/infra/container";
import { PATREON_STATE_COOKIE, patreonStateCookieOptions } from "../../../patreon/state-cookie";
import { adminRoute } from "../../admin-route";

/** "Conectar Patreon": remembers a random state and sends Daro to Patreon's consent page. */
export const GET = adminRoute(async (request) => {
  const patreon = container.patreon;
  if (!patreon)
    return Response.redirect(new URL("/admin/links?patreon=sin-configurar", request.url), 303);
  const { state, url } = patreon.start.execute();
  (await cookies()).set(PATREON_STATE_COOKIE, state, patreonStateCookieOptions);
  return new Response(null, {
    status: 303,
    headers: { Location: url, "Cache-Control": "no-store" },
  });
});
