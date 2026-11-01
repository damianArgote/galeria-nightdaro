import { container } from "@/infra/container";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * Render health check: the app is up. It does not query the database, so Neon can suspend when
 * idle and a database blip does not restart the app. `?db=1` also checks the database (manual use).
 */
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("db") !== "1") {
    return Response.json({ status: "ok" }, { headers: noStore });
  }
  try {
    await container.ping();
    return Response.json({ status: "ok", database: "ok" }, { headers: noStore });
  } catch (error) {
    console.error("Database health check failed", error);
    return Response.json({ status: "error", database: "error" }, { status: 503, headers: noStore });
  }
}
