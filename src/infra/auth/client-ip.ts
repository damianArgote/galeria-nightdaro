import { isIP } from "node:net";

/**
 * Client IP for rate limiting and the analytics session hash (never stored).
 *
 * On Render the request first goes through Cloudflare, which sets CF-Connecting-IP to the real
 * client; Render's proxy appends to X-Forwarded-For instead of replacing it. Set
 * CLIENT_IP_HEADER=cf-connecting-ip there and the IP comes from that header. Without it (local,
 * tests), the last X-Forwarded-For entry is used: the one added by the closest proxy.
 * Check what a deploy receives with GET /api/admin/ip-check.
 */
export function clientIp(headers: Headers): string {
  const trusted = trustedHeaderValue(headers);
  if (trusted && isIP(trusted)) return trusted;

  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || headers.get("x-real-ip") || "unknown";
}

function trustedHeaderValue(headers: Headers): string | undefined {
  const name = process.env.CLIENT_IP_HEADER;
  if (!name) return undefined;
  try {
    return headers.get(name)?.trim();
  } catch {
    // A misconfigured header name must not take every rate-limited route down.
    return undefined;
  }
}
