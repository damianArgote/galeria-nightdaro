import type {
  PatreonCampaign,
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
}
