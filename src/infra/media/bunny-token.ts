import { createHmac, timingSafeEqual } from "node:crypto";
import type { MediaUrlSigner } from "@/core/media/ports";

/**
 * Bunny CDN Token Authentication (advanced, HMAC-SHA256), without IP lock or extra parameters:
 * token = "HS256-" + base64url(HMAC-SHA256(key, path + expires)).
 * Same algorithm as BunnyWay/BunnyCDN.TokenAuthentication (nodejs/token.js); `tokenPath`
 * signs a path prefix instead of the file path.
 */
export function bunnyToken(
  securityKey: string,
  path: string,
  expires: number,
  tokenPath?: string,
): string {
  if (!securityKey) throw new Error("Bunny token key must not be empty");
  const signingData = tokenPath ? `token_path=${tokenPath}` : "";
  const digest = createHmac("sha256", securityKey)
    .update(tokenPath || path)
    .update(String(expires))
    .update(signingData)
    .digest("base64url");
  return `HS256-${digest}`;
}

export function signBunnyUrl(
  baseUrl: string,
  path: string,
  securityKey: string,
  expires: number,
  tokenPath?: string,
): string {
  const token = bunnyToken(securityKey, path, expires, tokenPath);
  const extra = tokenPath ? `&token_path=${encodeURIComponent(tokenPath)}` : "";
  return `${baseUrl}${path}?token=${token}${extra}&expires=${expires}`;
}

/** What Bunny does on each request; used by the local dev media route. */
export function verifyBunnyToken(
  securityKey: string,
  path: string,
  token: string | null,
  expires: string | null,
  now: Date = new Date(),
): boolean {
  if (!token || !expires || !/^\d+$/.test(expires)) return false;
  if (Number(expires) * 1000 <= now.getTime()) return false;
  const expected = Buffer.from(bunnyToken(securityKey, path, Number(expires)));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Signs public-zone keys for the Bunny Pull Zone (or the local dev route). */
export class SignedUrlService implements MediaUrlSigner {
  constructor(
    private readonly config: {
      /** e.g. https://cdn.nightdaro.com, or "" for same-origin dev URLs. */
      baseUrl: string;
      /** Path the key is served under: "" on the CDN, "/dev-media" locally. */
      pathPrefix: string;
      securityKey: string;
    },
  ) {}

  sign(key: string, expiresAt: Date): string {
    const expires = Math.floor(expiresAt.getTime() / 1000);
    const path = `${this.config.pathPrefix}/${key}`;
    return signBunnyUrl(this.config.baseUrl, path, this.config.securityKey, expires);
  }
}
