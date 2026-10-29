/**
 * Client IP for rate limiting. Uses the last X-Forwarded-For entry, which is the one added by
 * the closest proxy (Render), so a client cannot spoof it by sending its own header.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || headers.get("x-real-ip") || "unknown";
}
