import { container } from "@/infra/container";
import { visitorFrom } from "@/infra/analytics/visitor";
import { isCrawler } from "@/app/g/routing";

/**
 * "Ver completa en Patreon" from an artwork: records which artwork sent the visitor (not for
 * crawlers and link previews) and redirects to its Patreon post.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visitor = isCrawler(request.headers.get("user-agent"))
    ? null
    : visitorFrom(request.headers);
  const target = await container.recordArtworkClick.execute(
    { artworkId: id, referrer: request.headers.get("referer") },
    visitor,
  );
  if (!target) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store" },
  });
}
