import { z } from "zod";
import type {
  PatreonCampaign,
  PatreonMember,
  PatreonTokens,
  PatreonTrigger,
  PatreonWebhook,
} from "@/core/patreon/patreon";
import { PATRON_STATUSES } from "@/core/patreon/patreon";
import type { PatreonPort } from "@/core/patreon/ports";
import { systemClock, type Clock } from "@/core/shared/clock";

const SITE = "https://www.patreon.com";
const API = `${SITE}/api/oauth2/v2`;
/** Patreon may answer 403 to requests without a User-Agent. */
const USER_AGENT = "NightDaro-Gallery/1.0 (+https://www.nightdaro.com)";
const TIMEOUT_MS = 15_000;

export class PatreonApiError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Patreon API ${status}: ${detail.slice(0, 300)}`);
    this.name = "PatreonApiError";
  }
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
});

const ref = z.object({ id: z.string(), type: z.string() });

const campaignSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        attributes: z.object({ url: z.string().url() }),
        relationships: z.object({ tiers: z.object({ data: z.array(ref) }).optional() }).optional(),
      }),
    )
    .min(1, "Patreon returned no campaign for this account"),
  included: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        attributes: z
          .object({
            title: z.string().nullish(),
            amount_cents: z.number().int().nullish(),
            url: z.string().nullish(),
            published: z.boolean().nullish(),
          })
          .partial(),
      }),
    )
    .default([]),
});

/** A JSON:API member resource, as the members endpoint and the webhooks send it. */
export const memberResourceSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.literal("member"),
  attributes: z.object({
    patron_status: z.enum(PATRON_STATUSES).nullish(),
    currently_entitled_amount_cents: z.number().int().nullish(),
    pledge_relationship_start: z.string().nullish(),
  }),
  relationships: z
    .object({ currently_entitled_tiers: z.object({ data: z.array(ref) }).optional() })
    .optional(),
});

/** Keeps only what the Resumen needs: Patreon also sends names and emails, never kept. */
export function toMember(resource: z.infer<typeof memberResourceSchema>): PatreonMember {
  const start = resource.attributes.pledge_relationship_start;
  const pledgeStart = start ? new Date(start) : null;
  return {
    id: resource.id,
    status: resource.attributes.patron_status ?? null,
    amountCents: resource.attributes.currently_entitled_amount_cents ?? 0,
    tierIds: resource.relationships?.currently_entitled_tiers?.data.map((t) => t.id) ?? [],
    pledgeStart: pledgeStart && !Number.isNaN(pledgeStart.getTime()) ? pledgeStart : null,
  };
}

const memberSchema = z.object({ data: memberResourceSchema });
const webhooksSchema = z.object({
  data: z.array(z.object({ id: z.string(), attributes: z.object({ uri: z.string() }) })),
});
const MEMBER_FIELDS = "patron_status,currently_entitled_amount_cents,pledge_relationship_start";

const membersSchema = z.object({
  data: z.array(memberResourceSchema),
  meta: z
    .object({
      pagination: z
        .object({ cursors: z.object({ next: z.string().nullish() }).optional() })
        .optional(),
    })
    .optional(),
});

const webhookSchema = z.object({
  data: z.object({ id: z.string(), attributes: z.object({ secret: z.string().min(1) }) }),
});

/** Patreon OAuth and API v2 over fetch. Every response is validated before use. */
export class HttpPatreonAdapter implements PatreonPort {
  constructor(
    private readonly config: { clientId: string; clientSecret: string },
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: Clock = systemClock,
  ) {}

  authorizeUrl({
    state,
    redirectUri,
    scopes,
  }: {
    state: string;
    redirectUri: string;
    scopes: readonly string[];
  }): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
    });
    return `${SITE}/oauth2/authorize?${params}`;
  }

  exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }) {
    return this.token({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
  }

  refresh(refreshToken: string) {
    return this.token({ grant_type: "refresh_token", refresh_token: refreshToken });
  }

  async getCampaign(accessToken: string): Promise<PatreonCampaign> {
    const url = new URL(`${API}/campaigns`);
    url.searchParams.set("include", "tiers");
    url.searchParams.set("fields[campaign]", "url");
    url.searchParams.set("fields[tier]", "title,amount_cents,url,published");
    const body = campaignSchema.parse(await this.request(url, { accessToken }));
    const campaign = body.data[0]!;
    const tierIds = new Set(campaign.relationships?.tiers?.data.map((t) => t.id) ?? []);
    const tiers = body.included
      .filter((item) => item.type === "tier" && tierIds.has(item.id))
      .filter((tier) => tier.attributes.published !== false)
      .map((tier) => ({
        id: tier.id,
        title: tier.attributes.title ?? "",
        amountCents: tier.attributes.amount_cents ?? 0,
        url: tier.attributes.url ? new URL(tier.attributes.url, SITE).href : null,
      }));
    return { id: campaign.id, url: campaign.attributes.url, tiers };
  }

  async listMembers(accessToken: string, campaignId: string): Promise<PatreonMember[]> {
    const members: PatreonMember[] = [];
    let cursor: string | null | undefined;
    do {
      const url = new URL(`${API}/campaigns/${encodeURIComponent(campaignId)}/members`);
      url.searchParams.set("include", "currently_entitled_tiers");
      // Only these fields: no name, no email.
      url.searchParams.set("fields[member]", MEMBER_FIELDS);
      url.searchParams.set("page[count]", "1000");
      if (cursor) url.searchParams.set("page[cursor]", cursor);
      const body = membersSchema.parse(await this.request(url, { accessToken }));
      members.push(...body.data.map(toMember));
      cursor = body.meta?.pagination?.cursors?.next;
    } while (cursor);
    return members;
  }

  async getMember(accessToken: string, memberId: string): Promise<PatreonMember | null> {
    const url = new URL(`${API}/members/${encodeURIComponent(memberId)}`);
    url.searchParams.set("include", "currently_entitled_tiers");
    url.searchParams.set("fields[member]", MEMBER_FIELDS);
    try {
      return toMember(memberSchema.parse(await this.request(url, { accessToken })).data);
    } catch (error) {
      if (error instanceof PatreonApiError && error.status === 404) return null;
      throw error;
    }
  }

  async listWebhooks(accessToken: string): Promise<{ id: string; uri: string }[]> {
    const url = new URL(`${API}/webhooks`);
    url.searchParams.set("fields[webhook]", "uri");
    const body = webhooksSchema.parse(await this.request(url, { accessToken }));
    return body.data.map((w) => ({ id: w.id, uri: w.attributes.uri }));
  }

  async createWebhook(
    accessToken: string,
    input: { campaignId: string; uri: string; triggers: readonly PatreonTrigger[] },
  ): Promise<PatreonWebhook> {
    const body = webhookSchema.parse(
      await this.request(new URL(`${API}/webhooks`), {
        accessToken,
        method: "POST",
        json: {
          data: {
            type: "webhook",
            attributes: { triggers: input.triggers, uri: input.uri },
            relationships: { campaign: { data: { type: "campaign", id: input.campaignId } } },
          },
        },
      }),
    );
    return { id: body.data.id, secret: body.data.attributes.secret };
  }

  async deleteWebhook(accessToken: string, webhookId: string): Promise<void> {
    await this.request(new URL(`${API}/webhooks/${encodeURIComponent(webhookId)}`), {
      accessToken,
      method: "DELETE",
    });
  }

  private async token(params: Record<string, string>): Promise<PatreonTokens> {
    const body = tokenSchema.parse(
      await this.request(new URL(`${SITE}/api/oauth2/token`), {
        method: "POST",
        form: {
          ...params,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
      }),
    );
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(this.clock().getTime() + body.expires_in * 1000),
    };
  }

  private async request(
    url: URL,
    options: {
      accessToken?: string;
      method?: string;
      json?: unknown;
      form?: Record<string, string>;
    },
  ): Promise<unknown> {
    const headers = new Headers({ "User-Agent": USER_AGENT, Accept: "application/json" });
    if (options.accessToken) headers.set("Authorization", `Bearer ${options.accessToken}`);
    let body: string | undefined;
    if (options.json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.json);
    } else if (options.form) {
      headers.set("Content-Type", "application/x-www-form-urlencoded");
      body = new URLSearchParams(options.form).toString();
    }
    const response = await this.fetchImpl(url, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new PatreonApiError(response.status, await response.text());
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
}
