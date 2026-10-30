import "server-only";
import { requireAdmin } from "@/auth";
import { UnauthorizedError } from "@/infra/auth/require-admin";

/**
 * Wraps an admin route handler: no session, no handler. Every export of a route under
 * src/app/api/admin must be built with it (tests/admin-actions-guard.test.ts).
 */
export function adminRoute(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      await requireAdmin();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return Response.json(
          { ok: false, error: "Tu sesión venció. Volvé a entrar." },
          { status: 401 },
        );
      }
      throw error;
    }
    return handler(request);
  };
}
