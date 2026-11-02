import type {
  PatreonCampaign,
  PatreonConnection,
  PatreonEvent,
  PatreonPost,
  PatreonTier,
  PatreonMember,
  PatreonTokens,
  PatreonTrigger,
  PatreonWebhook,
} from "@/core/patreon/patreon";
import type {
  PatreonConnectionRepository,
  PatreonEventCount,
  PatreonEventRepository,
  PatreonMemberRepository,
  PatreonPort,
  PatreonTierCatalog,
} from "@/core/patreon/ports";

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
  readonly posts = new Map<string, PatreonPost>();
  readonly images = new Map<string, Uint8Array>();
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

  async getMember(accessToken: string, memberId: string): Promise<PatreonMember | null> {
    this.calls.push(`member:${accessToken}:${memberId}`);
    const member = this.members.find((m) => m.id === memberId);
    return member ? structuredClone(member) : null;
  }

  async listWebhooks(accessToken: string) {
    this.calls.push(`webhook:list:${accessToken}`);
    return [...this.webhooks].map(([id, { uri }]) => ({ id, uri }));
  }

  async listPosts(accessToken: string, campaignId: string): Promise<PatreonPost[]> {
    this.calls.push(`posts:${accessToken}:${campaignId}`);
    return [...this.posts.values()].map((p) => ({ ...structuredClone(p), content: null }));
  }

  async getPost(accessToken: string, postId: string): Promise<PatreonPost | null> {
    this.calls.push(`post:${accessToken}:${postId}`);
    const post = this.posts.get(postId);
    return post ? structuredClone(post) : null;
  }

  async downloadPostImage(url: string): Promise<Uint8Array | null> {
    return this.images.get(url) ?? null;
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

  async webhookSecret() {
    return this.connection?.webhook?.secret ?? null;
  }
}

export class FakePatreonTierCatalog implements PatreonTierCatalog {
  tiers: PatreonTier[] = [];
  async list() {
    return structuredClone(this.tiers);
  }
  async replace(tiers: PatreonTier[]) {
    this.tiers = structuredClone(tiers);
  }
}

export class FakePatreonMemberRepository implements PatreonMemberRepository {
  readonly items = new Map<string, PatreonMember>();
  async list() {
    return [...this.items.values()].map((m) => structuredClone(m));
  }
  async save(member: PatreonMember) {
    this.items.set(member.id, structuredClone(member));
  }
  async replaceAll(members: PatreonMember[]) {
    this.items.clear();
    for (const member of members) await this.save(member);
  }
}

export class FakePatreonEventRepository implements PatreonEventRepository {
  readonly events: PatreonEvent[] = [];
  /** Day in Buenos Aires (UTC-3, no DST) of each event, as the database computes it. */
  async countInRange({ from, to }: { from: string; to: string }) {
    const day = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
    const counts = new Map<string, PatreonEventCount>();
    for (const event of this.events) {
      const d = day(event.occurredAt);
      if (d < from || d > to) continue;
      const key = `${event.kind}|${event.patreonTierId}`;
      const current = counts.get(key) ?? {
        kind: event.kind,
        patreonTierId: event.patreonTierId,
        count: 0,
      };
      counts.set(key, { ...current, count: current.count + 1 });
    }
    return [...counts.values()];
  }
  async recordOnce(event: PatreonEvent) {
    if (this.events.some((e) => e.key === event.key)) return false;
    this.events.push(structuredClone(event));
    return true;
  }
}
