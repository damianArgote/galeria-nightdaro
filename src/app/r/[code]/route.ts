import { container } from "@/infra/container";

/** Tracking link: redirects to the tier or social target. Click counting arrives in step 9. */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-z0-9-]{3,32}$/.test(code)) return new Response("Not found", { status: 404 });

  const link = await container.findTrackingLink(code);
  if (!link) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 302,
    headers: { Location: link.targetUrl, "Cache-Control": "no-store" },
  });
}
