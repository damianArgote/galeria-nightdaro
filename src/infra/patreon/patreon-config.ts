import { requireEnv } from "@/db/env";
import { HttpPatreonAdapter } from "./http-patreon-adapter";
import { TokenCipher } from "./token-cipher";

export const PATREON_CALLBACK_PATH = "/api/patreon/callback";
export const PATREON_WEBHOOK_PATH = "/api/webhooks/patreon";

export interface PatreonSetup {
  port: HttpPatreonAdapter;
  cipher: TokenCipher;
  redirectUri: string;
  webhookUri: string;
}

/**
 * Null until the Patreon client is registered: PATREON_CLIENT_ID and PATREON_CLIENT_SECRET.
 * Once they are set, PATREON_TOKEN_KEY (encryption) and SITE_URL are required too.
 */
export function patreonSetup(): PatreonSetup | null {
  const clientId = process.env.PATREON_CLIENT_ID;
  const clientSecret = process.env.PATREON_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const site = requireEnv("SITE_URL").replace(/\/$/, "");
  return {
    port: new HttpPatreonAdapter({ clientId, clientSecret }),
    cipher: new TokenCipher(requireEnv("PATREON_TOKEN_KEY")),
    redirectUri: `${site}${PATREON_CALLBACK_PATH}`,
    webhookUri: `${site}${PATREON_WEBHOOK_PATH}`,
  };
}
