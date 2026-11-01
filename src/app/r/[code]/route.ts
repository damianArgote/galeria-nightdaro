import { container } from "@/infra/container";
import { visitorFrom } from "@/infra/analytics/visitor";
import { isCrawler } from "@/app/g/routing";

/** Tracking link: records the click (not for crawlers and link previews) and redirects. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-z0-9-]{3,32}$/.test(code)) return new Response("Not found", { status: 404 });

  const visitor = isCrawler(request.headers.get("user-agent"))
    ? null
    : visitorFrom(request.headers);
  const target = await container.recordClick.execute(
    { code, referrer: request.headers.get("referer") },
    visitor,
  );
  if (!target) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store" },
  });
}
