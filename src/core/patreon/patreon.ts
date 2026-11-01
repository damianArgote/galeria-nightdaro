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
