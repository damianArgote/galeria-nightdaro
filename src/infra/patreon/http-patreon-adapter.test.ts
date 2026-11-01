import { describe, expect, it, vi } from "vitest";
import { HttpPatreonAdapter, PatreonApiError } from "./http-patreon-adapter";

type Call = { url: URL; init: RequestInit };

function fakeFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    calls.push({ url: new URL(String(input)), init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return new Response(next.body === null ? null : JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const config = { clientId: "client-id", clientSecret: "client-secret" };
const NOW = new Date("2026-11-01T12:00:00Z");

describe("HttpPatreonAdapter", () => {
  it("builds the authorize URL with the v2 scopes and the state", () => {
    const url = new URL(
      new HttpPatreonAdapter(config).authorizeUrl({
        state: "abc",
        redirectUri: "https://www.nightdaro.com/api/patreon/callback",
        scopes: ["campaigns", "w:campaigns.webhook"],
      }),
    );
    expect(url.origin + url.pathname).toBe("https://www.patreon.com/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "client-id",
      redirect_uri: "https://www.nightdaro.com/api/patreon/callback",
      scope: "campaigns w:campaigns.webhook",
      state: "abc",
    });
  });

  it("exchanges a code server side and computes the expiry", async () => {
    const { fetch, calls } = fakeFetch([
      {
        body: {
          access_token: "at",
          refresh_token: "rt",
          expires_in: 2_678_400,
          scope: "campaigns",
          token_type: "Bearer",
        },
      },
    ]);
    const tokens = await new HttpPatreonAdapter(config, fetch, () => NOW).exchangeCode({
      code: "the-code",
      redirectUri: "https://www.nightdaro.com/api/patreon/callback",
    });

    expect(tokens).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: new Date(NOW.getTime() + 2_678_400_000),
    });
    expect(calls[0]!.url.href).toBe("https://www.patreon.com/api/oauth2/token");
    expect(calls[0]!.init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(String(calls[0]!.init.body)))).toEqual({
      code: "the-code",
      grant_type: "authorization_code",
      client_id: "client-id",
      client_secret: "client-secret",
      redirect_uri: "https://www.nightdaro.com/api/patreon/callback",
    });
  });

  it("refreshes with the refresh token grant", async () => {
    const { fetch, calls } = fakeFetch([
      { body: { access_token: "at2", refresh_token: "rt2", expires_in: 60 } },
    ]);
    await new HttpPatreonAdapter(config, fetch, () => NOW).refresh("rt");
    expect(new URLSearchParams(String(calls[0]!.init.body)).get("grant_type")).toBe(
      "refresh_token",
    );
    expect(new URLSearchParams(String(calls[0]!.init.body)).get("refresh_token")).toBe("rt");
  });

  it("reads the campaign and its published tiers, sending a bearer token and a User-Agent", async () => {
    const { fetch, calls } = fakeFetch([
      {
        body: {
          data: [
            {
              id: "camp-1",
              type: "campaign",
              attributes: { url: "https://www.patreon.com/Ndaro" },
              relationships: { tiers: { data: [{ id: "t5", type: "tier" }] } },
            },
          ],
          included: [
            {
              id: "t5",
              type: "tier",
              attributes: {
                title: "Support",
                amount_cents: 500,
                url: "/checkout/Ndaro?rid=5",
                published: true,
              },
            },
            {
              id: "t0",
              type: "tier",
              attributes: { title: "Old", amount_cents: 300, url: null, published: false },
            },
          ],
        },
      },
    ]);
    const campaign = await new HttpPatreonAdapter(config, fetch).getCampaign("at");

    expect(campaign).toEqual({
      id: "camp-1",
      url: "https://www.patreon.com/Ndaro",
      tiers: [
        {
          id: "t5",
          title: "Support",
          amountCents: 500,
          url: "https://www.patreon.com/checkout/Ndaro?rid=5",
        },
      ],
    });
    const { url, init } = calls[0]!;
    expect(url.pathname).toBe("/api/oauth2/v2/campaigns");
    expect(url.searchParams.get("include")).toBe("tiers");
    expect(url.searchParams.get("fields[tier]")).toBe("title,amount_cents,url,published");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer at");
    expect(headers.get("user-agent")).toMatch(/NightDaro/);
  });

  it("lists every member page without asking for names or emails", async () => {
    const member = (id: string, tiers: string[]) => ({
      id,
      type: "member",
      attributes: {
        patron_status: "active_patron",
        currently_entitled_amount_cents: 500,
        pledge_relationship_start: "2026-10-01T00:00:00.000+00:00",
      },
      relationships: {
        currently_entitled_tiers: { data: tiers.map((t) => ({ id: t, type: "tier" })) },
      },
    });
    const { fetch, calls } = fakeFetch([
      { body: { data: [member("m1", ["t5"])], meta: { pagination: { cursors: { next: "c2" } } } } },
      { body: { data: [member("m2", [])], meta: { pagination: { cursors: { next: null } } } } },
    ]);

    const members = await new HttpPatreonAdapter(config, fetch).listMembers("at", "camp-1");

    expect(members).toEqual([
      {
        id: "m1",
        status: "active_patron",
        amountCents: 500,
        tierIds: ["t5"],
        pledgeStart: new Date("2026-10-01T00:00:00Z"),
      },
      {
        id: "m2",
        status: "active_patron",
        amountCents: 500,
        tierIds: [],
        pledgeStart: new Date("2026-10-01T00:00:00Z"),
      },
    ]);
    expect(calls[0]!.url.pathname).toBe("/api/oauth2/v2/campaigns/camp-1/members");
    expect(calls[0]!.url.searchParams.get("fields[member]")).toBe(
      "patron_status,currently_entitled_amount_cents,pledge_relationship_start",
    );
    expect(calls[0]!.url.searchParams.get("fields[member]")).not.toMatch(/email|name/);
    expect(calls[1]!.url.searchParams.get("page[cursor]")).toBe("c2");
  });

  it("creates the webhook with the JSON:API body and returns its secret", async () => {
    const { fetch, calls } = fakeFetch([
      {
        status: 201,
        body: { data: { id: "wh-1", type: "webhook", attributes: { secret: "s3cret" } } },
      },
    ]);
    const webhook = await new HttpPatreonAdapter(config, fetch).createWebhook("at", {
      campaignId: "camp-1",
      uri: "https://www.nightdaro.com/api/webhooks/patreon",
      triggers: ["members:pledge:create", "posts:publish"],
    });

    expect(webhook).toEqual({ id: "wh-1", secret: "s3cret" });
    expect(calls[0]!.url.pathname).toBe("/api/oauth2/v2/webhooks");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      data: {
        type: "webhook",
        attributes: {
          triggers: ["members:pledge:create", "posts:publish"],
          uri: "https://www.nightdaro.com/api/webhooks/patreon",
        },
        relationships: { campaign: { data: { type: "campaign", id: "camp-1" } } },
      },
    });
  });

  it("deletes a webhook and turns API errors into PatreonApiError with the status", async () => {
    const { fetch, calls } = fakeFetch([
      { status: 204, body: null },
      { status: 401, body: { errors: [{ detail: "Unauthorized" }] } },
    ]);
    const adapter = new HttpPatreonAdapter(config, fetch);
    await adapter.deleteWebhook("at", "wh-1");
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url.pathname).toBe("/api/oauth2/v2/webhooks/wh-1");

    const error = await adapter.getCampaign("at").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PatreonApiError);
    expect((error as PatreonApiError).status).toBe(401);
  });

  it("rejects a response with an unexpected shape", async () => {
    const { fetch } = fakeFetch([{ body: { data: [] } }]);
    await expect(new HttpPatreonAdapter(config, fetch).getCampaign("at")).rejects.toThrow(
      /campaign/i,
    );
  });
});
