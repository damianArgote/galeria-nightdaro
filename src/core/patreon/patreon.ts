/** Scopes asked to Daro: read the campaign, its members and posts, and manage its webhook. */
export const PATREON_SCOPES = [
  "campaigns",
  "campaigns.members",
  "campaigns.posts",
  "w:campaigns.webhook",
] as const;

/** Webhook triggers: new, changed and ended pledges, plus new posts (gallery drafts). */
export const PATREON_TRIGGERS = [
  "members:pledge:create",
  "members:pledge:update",
  "members:pledge:delete",
  "posts:publish",
] as const;
export type PatreonTrigger = (typeof PATREON_TRIGGERS)[number];

export interface PatreonTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface PatreonTier {
  id: string;
  title: string;
  amountCents: number;
  /** Checkout URL of the tier on patreon.com. */
  url: string | null;
}

export interface PatreonCampaign {
  id: string;
  url: string;
  tiers: PatreonTier[];
}

export const PATRON_STATUSES = ["active_patron", "declined_patron", "former_patron"] as const;
export type PatronStatus = (typeof PATRON_STATUSES)[number];

/** A member of the campaign, without name or email: never requested, never stored. */
export interface PatreonMember {
  id: string;
  status: PatronStatus | null;
  amountCents: number;
  tierIds: string[];
  pledgeStart: Date | null;
}

export interface PatreonWebhook {
  id: string;
  secret: string;
}

/** The single connection of the site to Daro's campaign. */
export interface PatreonConnection {
  campaignId: string;
  campaignUrl: string;
  tokens: PatreonTokens;
  webhook: PatreonWebhook | null;
  connectedAt: Date;
}

/** What a pledge webhook means for the Resumen. */
export const PATREON_EVENT_KINDS = ["alta", "baja", "cambio"] as const;
export type PatreonEventKind = (typeof PATREON_EVENT_KINDS)[number];

export const PLEDGE_EVENT_KINDS: Record<string, PatreonEventKind> = {
  "members:pledge:create": "alta",
  "members:pledge:update": "cambio",
  "members:pledge:delete": "baja",
};

export interface PatreonEvent {
  /** Hash of the trigger and the raw body: Patreon retries deliver the same event again. */
  key: string;
  kind: PatreonEventKind;
  memberId: string;
  amountCents: number;
  patreonTierId: string | null;
  occurredAt: Date;
}

/** A post of the campaign, read back from the API (the webhook payload is not trusted). */
export interface PatreonPost {
  id: string;
  title: string | null;
  url: string | null;
  publishedAt: Date | null;
  /** HTML; may hold the post's images. */
  content: string | null;
}

/** Only images Patreon itself hosts are ever downloaded from a post. */
export function isPatreonImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".patreonusercontent.com");
  } catch {
    return false;
  }
}

/** The first image of a post's HTML hosted by Patreon, if any. */
export function firstPostImage(content: string | null): string | null {
  if (!content) return null;
  for (const match of content.matchAll(/<img\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)) {
    const src = match[1]!.replaceAll("&amp;", "&");
    if (isPatreonImageUrl(src)) return src;
  }
  return null;
}
