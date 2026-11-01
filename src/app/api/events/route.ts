import { ZodError } from "zod";
import { container } from "@/infra/container";
import { clientIp } from "@/infra/auth/client-ip";
import { visitorFrom } from "@/infra/analytics/visitor";
import { isSameSiteOrigin } from "@/infra/http/public-url";
import { isCrawler } from "@/app/g/routing";

const MAX_BODY_BYTES = 4096;
const noContent = () => new Response(null, { status: 204 });

/**
 * Views and age gate acceptances sent by the browser (pages are cached, so they are never
 * counted while rendering, and bots that do not run JS are never counted). The IP is only used
 * for the rate limit and the daily session hash; it is never stored.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !isSameSiteOrigin(origin, request)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (isCrawler(request.headers.get("user-agent"))) return noContent();
  if (!container.eventRateLimiter.consume(clientIp(request.headers))) {
    return new Response("Too many requests", { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });

  try {
    await container.recordClientEvent.execute(JSON.parse(raw), visitorFrom(request.headers));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return new Response("Bad request", { status: 400 });
    }
    throw error;
  }
  return noContent();
}
