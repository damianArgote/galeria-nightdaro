import { beforeEach, describe, expect, it } from "vitest";
import { FakePatreonConnectionRepository, FakePatreonPort } from "@/infra/patreon/fake-patreon";
import { ConflictError } from "../shared/errors";
import {
  CompletePatreonConnect,
  DisconnectPatreon,
  GetPatreonStatus,
  PatreonAccess,
  PatreonNotConnectedError,
  StartPatreonConnect,
} from "./connect";

const REDIRECT = "https://www.nightdaro.com/api/patreon/callback";
const NOW = new Date("2026-11-01T12:00:00Z");

let patreon: FakePatreonPort;
let connections: FakePatreonConnectionRepository;

beforeEach(() => {
  patreon = new FakePatreonPort();
  connections = new FakePatreonConnectionRepository();
});

describe("StartPatreonConnect", () => {
  it("returns a fresh random state and the authorize URL that carries it", () => {
    const start = new StartPatreonConnect(patreon, REDIRECT);
    const a = start.execute();
    const b = start.execute();

    expect(a.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.state).not.toBe(b.state);
    const url = new URL(a.url);
    expect(url.searchParams.get("state")).toBe(a.state);
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("scope")).toBe(
      "campaigns campaigns.members campaigns.posts w:campaigns.webhook",
    );
  });
});

describe("CompletePatreonConnect", () => {
  const complete = () => new CompletePatreonConnect(patreon, connections, REDIRECT, () => NOW);

  it("rejects a state that does not match the one handed out, before touching Patreon", async () => {
    await expect(
      complete().execute({ code: "good-code", state: "forged", expectedState: "issued" }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      complete().execute({ code: "good-code", state: "issued", expectedState: undefined }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(patreon.calls).toEqual([]);
    expect(connections.connection).toBeNull();
  });

  it("exchanges the code, reads the campaign and stores the connection", async () => {
    await complete().execute({ code: "good-code", state: "issued", expectedState: "issued" });

    expect(connections.connection).toMatchObject({
      campaignId: "camp-1",
      campaignUrl: "https://www.patreon.com/cw/Ndaro",
      tokens: { accessToken: "access-1", refreshToken: "refresh-1" },
      connectedAt: NOW,
    });
  });

  it("stores nothing when Patreon rejects the code", async () => {
    await expect(
      complete().execute({ code: "bad", state: "issued", expectedState: "issued" }),
    ).rejects.toThrow("invalid_grant");
    expect(connections.connection).toBeNull();
  });
});

describe("PatreonAccess", () => {
  const connected = async (expiresAt: Date) => {
    await connections.save({
      campaignId: "camp-1",
      campaignUrl: "https://www.patreon.com/cw/Ndaro",
      tokens: { accessToken: "old-access", refreshToken: "old-refresh", expiresAt },
      webhook: null,
      connectedAt: NOW,
    });
  };

  it("uses the stored token while it is valid for more than 5 minutes", async () => {
    await connected(new Date(NOW.getTime() + 3_600_000));
    const access = new PatreonAccess(patreon, connections, () => NOW);

    expect(await access.token()).toBe("old-access");
    expect(patreon.calls).toEqual([]);
  });

  it("refreshes once, even for concurrent callers, and stores the new pair", async () => {
    await connected(new Date(NOW.getTime() + 60_000));
    const access = new PatreonAccess(patreon, connections, () => NOW);

    const tokens = await Promise.all([access.token(), access.token(), access.token()]);

    expect(new Set(tokens).size).toBe(1);
    expect(patreon.calls).toEqual(["refresh:old-refresh"]);
    expect((await connections.get())?.tokens.refreshToken).not.toBe("old-refresh");
  });

  it("uses the token another caller already refreshed instead of burning the old refresh token", async () => {
    await connected(new Date(NOW.getTime() + 60_000));
    const access = new PatreonAccess(patreon, connections, () => NOW);
    // Another process refreshed between our read and our refresh.
    const realGet = connections.get.bind(connections);
    let first = true;
    connections.get = async () => {
      const row = await realGet();
      if (first) {
        first = false;
        await connections.save({
          ...row!,
          tokens: {
            accessToken: "fresh-access",
            refreshToken: "fresh-refresh",
            expiresAt: new Date(NOW.getTime() + 3_600_000),
          },
        });
      }
      return row;
    };

    expect(await access.token()).toBe("fresh-access");
    expect(patreon.calls).toEqual([]);
  });

  it("fails clearly when Patreon is not connected", async () => {
    await expect(new PatreonAccess(patreon, connections, () => NOW).token()).rejects.toBeInstanceOf(
      PatreonNotConnectedError,
    );
  });
});

describe("DisconnectPatreon and GetPatreonStatus", () => {
  it("deletes the webhook at Patreon and forgets the connection", async () => {
    await new CompletePatreonConnect(patreon, connections, REDIRECT, () => NOW).execute({
      code: "good-code",
      state: "s",
      expectedState: "s",
    });
    const webhook = await patreon.createWebhook("access-1", {
      campaignId: "camp-1",
      uri: "https://x",
      triggers: ["posts:publish"],
    });
    await connections.save({ ...connections.connection!, webhook });
    expect(await new GetPatreonStatus(connections).execute()).toEqual({
      connected: true,
      campaignUrl: "https://www.patreon.com/cw/Ndaro",
      connectedAt: NOW,
    });

    await new DisconnectPatreon(patreon, connections, () => NOW).execute();

    expect(patreon.webhooks.size).toBe(0);
    expect(connections.connection).toBeNull();
    expect(await new GetPatreonStatus(connections).execute()).toEqual({ connected: false });
  });

  it("forgets the connection even when Patreon fails to delete the webhook", async () => {
    await connections.save({
      campaignId: "camp-1",
      campaignUrl: "https://www.patreon.com/cw/Ndaro",
      tokens: {
        accessToken: "a",
        refreshToken: "r",
        expiresAt: new Date(NOW.getTime() + 3_600_000),
      },
      webhook: { id: "wh-x", secret: "s" },
      connectedAt: NOW,
    });
    patreon.deleteWebhook = async () => {
      throw new Error("Patreon is down");
    };

    await new DisconnectPatreon(patreon, connections, () => NOW).execute();
    expect(connections.connection).toBeNull();
  });
});
