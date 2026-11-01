import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { PatreonMember } from "@/core/patreon/patreon";
import { memberResourceSchema, toMember } from "./http-patreon-adapter";

const MD5_HEX = /^[0-9a-f]{32}$/i;

/** Patreon signs the raw body: X-Patreon-Signature is the hex HMAC-MD5 with the webhook secret. */
export function verifyPatreonSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !MD5_HEX.test(signature)) return false;
  const expected = createHmac("md5", secret).update(rawBody, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

/** Same trigger and body means the same delivery retried. */
export function webhookKey(trigger: string, rawBody: string): string {
  return createHash("sha256").update(`${trigger}\n${rawBody}`).digest("hex");
}

/** The member a pledge webhook is about; anything but its state is discarded. */
export function parsePledgeWebhook(rawBody: string): PatreonMember {
  const payload = JSON.parse(rawBody) as { data?: unknown };
  return toMember(memberResourceSchema.parse(payload.data));
}
