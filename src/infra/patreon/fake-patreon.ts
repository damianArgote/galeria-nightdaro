import type {
  PatreonCampaign,
  PatreonConnection,
  PatreonMember,
  PatreonTokens,
  PatreonTrigger,
  PatreonWebhook,
} from "@/core/patreon/patreon";
import type { PatreonConnectionRepository, PatreonPort } from "@/core/patreon/ports";

/** In-memory Patreon for tests and the e2e suite: records every call it receives. */
export class FakePatreonPort implements PatreonPort {
  campaign: PatreonCampaign = {
    id: "camp-1",
    url: "https://www.patreon.com/cw/Ndaro",
    tiers: [
      {
        id: "pt-5",
        title: "Support",
        amountCents: 500,
        url: "https://www.patreon.com/checkout/Ndaro?rid=5",
      },
      {
        id: "pt-10",
        title: "Advanced support",
        amountCents: 1000,
        url: "https://www.patreon.com/checkout/Ndaro?rid=10",
      },
    ],
  };
  members: PatreonMember[] = [];
  readonly calls: string[] = [];
  readonly webhooks = new Map<string, { uri: string; triggers: readonly PatreonTrigger[] }>();
  private counter = 0;
  /** Codes the fake accepts; anything else fails like Patreon's invalid_grant. */
  validCodes = new Set(["good-code"]);

  authorizeUrl({
    state,
    redirectUri,
    scopes,
  }: {
    state: string;
    redirectUri: string;
    scopes: readonly string[];
  }) {
    const params = new URLSearchParams({
      response_type: "code",
      state,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
    });
    return `https://www.patreon.com/oauth2/authorize?${params}`;
  }

  async exchangeCode({ code }: { code: string; redirectUri: string }): Promise<PatreonTokens> {
    this.calls.push(`exchange:${code}`);
    if (!this.validCodes.has(code)) throw new Error("invalid_grant");
    return this.tokens();
  }

  async refresh(refreshToken: string): Promise<PatreonTokens> {
    this.calls.push(`refresh:${refreshToken}`);
    return this.tokens();
  }

  async getCampaign(accessToken: string): Promise<PatreonCampaign> {
    this.calls.push(`campaign:${accessToken}`);
    return structuredClone(this.campaign);
  }

  async listMembers(accessToken: string, campaignId: string): Promise<PatreonMember[]> {
    this.calls.push(`members:${accessToken}:${campaignId}`);
    return structuredClone(this.members);
  }

  async createWebhook(
    accessToken: string,
    { uri, triggers }: { campaignId: string; uri: string; triggers: readonly PatreonTrigger[] },
  ): Promise<PatreonWebhook> {
    this.calls.push(`webhook:create:${accessToken}`);
    const id = `wh-${++this.counter}`;
    this.webhooks.set(id, { uri, triggers });
    return { id, secret: `secret-${id}` };
  }

  async deleteWebhook(accessToken: string, webhookId: string): Promise<void> {
    this.calls.push(`webhook:delete:${accessToken}:${webhookId}`);
    this.webhooks.delete(webhookId);
  }

  private tokens(): PatreonTokens {
    const n = ++this.counter;
    return {
      accessToken: `access-${n}`,
      refreshToken: `refresh-${n}`,
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    };
  }
}

export class FakePatreonConnectionRepository implements PatreonConnectionRepository {
  connection: PatreonConnection | null = null;

  async get() {
    return this.connection && structuredClone(this.connection);
  }

  async save(connection: PatreonConnection) {
    this.connection = structuredClone(connection);
  }

  async delete() {
    this.connection = null;
  }
}
