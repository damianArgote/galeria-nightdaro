import { clientIp } from "@/infra/auth/client-ip";
import { adminRoute } from "../admin-route";

const HEADERS = ["cf-connecting-ip", "true-client-ip", "x-forwarded-for", "x-real-ip"] as const;

/**
 * Deploy diagnostic (admin only): which IP headers reach the app and which IP the rate limit
 * uses. Compare "resolved" with your own public IP. Nothing is stored.
 */
export const GET = adminRoute(async (request) =>
  Response.json(
    {
      resolved: clientIp(request.headers),
      clientIpHeader: process.env.CLIENT_IP_HEADER ?? null,
      headers: Object.fromEntries(HEADERS.map((h) => [h, request.headers.get(h)])),
    },
    { headers: { "Cache-Control": "no-store" } },
  ),
);
