import { PATREON_TRIGGERS, PLEDGE_EVENT_KINDS } from "@/core/patreon/patreon";
import { container } from "@/infra/container";
import {
  parsePledgeWebhook,
  verifyPatreonSignature,
  webhookKey,
} from "@/infra/patreon/patreon-webhook";

const MAX_BODY_BYTES = 1_000_000;

/**
 * Patreon webhook. The signature (HMAC-MD5 of the raw body with the webhook secret) is checked
 * before anything is parsed; a retried delivery counts once. Fans' names and emails in the
 * payload are discarded.
 */
export async function POST(request: Request) {
  const patreon = container.patreon;
  if (!patreon) return new Response("Not found", { status: 404 });
  let secret: string | null;
  try {
    secret = await patreon.webhookSecret();
  } catch (error) {
    // Unreadable secret (database down, PATREON_TOKEN_KEY changed): Patreon retries later.
    console.error("Could not read the Patreon webhook secret", error);
    return new Response("Unavailable", { status: 503 });
  }
  if (!secret) return new Response("Not found", { status: 404 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new Response("Too large", { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return new Response("Too large", { status: 413 });
  }
  if (!verifyPatreonSignature(raw, request.headers.get("x-patreon-signature"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const trigger = request.headers.get("x-patreon-event") ?? "";
  if (!(PATREON_TRIGGERS as readonly string[]).includes(trigger)) {
    return new Response("Unknown event", { status: 400 });
  }
  // posts:publish becomes a gallery draft in a later step; acknowledged meanwhile.
  if (!PLEDGE_EVENT_KINDS[trigger]) return new Response(null, { status: 204 });

  let member;
  try {
    member = parsePledgeWebhook(raw);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
  await patreon.recordPledge.execute({ trigger, key: webhookKey(trigger, raw), member });
  return new Response(null, { status: 204 });
}
