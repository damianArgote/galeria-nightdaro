import { container } from "@/infra/container";

export const dynamic = "force-dynamic";

/** Render health check: 200 when the app and the database answer, 503 otherwise. */
export async function GET() {
  try {
    await container.ping();
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
