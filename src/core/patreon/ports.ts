import type {
  PatreonCampaign,
  PatreonEvent,
  PatreonTier,
  PatreonConnection,
  PatreonMember,
  PatreonTokens,
  PatreonTrigger,
  PatreonWebhook,
} from "./patreon";

/** Patreon API v2 and its OAuth endpoints. */
export interface PatreonPort {
  authorizeUrl(input: { state: string; redirectUri: string; scopes: readonly string[] }): string;
  exchangeCode(input: { code: string; redirectUri: string }): Promise<PatreonTokens>;
  /** Refresh tokens are single use: the new pair replaces the old one. */
  refresh(refreshToken: string): Promise<PatreonTokens>;
  getCampaign(accessToken: string): Promise<PatreonCampaign>;
  listMembers(accessToken: string, campaignId: string): Promise<PatreonMember[]>;
  /** Current state of one member; null when Patreon no longer has it. */
  getMember(accessToken: string, memberId: string): Promise<PatreonMember | null>;
  listWebhooks(accessToken: string): Promise<{ id: string; uri: string }[]>;
  createWebhook(
    accessToken: string,
    input: { campaignId: string; uri: string; triggers: readonly PatreonTrigger[] },
  ): Promise<PatreonWebhook>;
  deleteWebhook(accessToken: string, webhookId: string): Promise<void>;
}

/** Stores the single connection; the adapter encrypts tokens and the webhook secret at rest. */
export interface PatreonConnectionRepository {
  get(): Promise<PatreonConnection | null>;
  save(connection: PatreonConnection): Promise<void>;
  delete(): Promise<void>;
  /** Only the webhook secret, for the webhook route: nothing else is decrypted per request. */
  webhookSecret(): Promise<string | null>;
}

/** Daro's Patreon tiers as last read from Patreon (names and prices for the panel). */
export interface PatreonTierCatalog {
  list(): Promise<PatreonTier[]>;
  replace(tiers: PatreonTier[]): Promise<void>;
}

/** Current state of each member: no name, no email. */
export interface PatreonMemberRepository {
  list(): Promise<PatreonMember[]>;
  save(member: PatreonMember): Promise<void>;
  /** Initial sync: the given members become the whole table. */
  replaceAll(members: PatreonMember[]): Promise<void>;
}

export interface PatreonEventRepository {
  /** False when an event with the same key was already recorded (a retried delivery). */
  recordOnce(event: PatreonEvent): Promise<boolean>;
}
