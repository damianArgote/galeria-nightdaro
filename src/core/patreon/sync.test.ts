import { beforeEach, describe, expect, it } from "vitest";
import { FakeTierRepository } from "@/infra/links/fake-link-repositories";
import {
  FakePatreonConnectionRepository,
  FakePatreonEventRepository,
  FakePatreonMemberRepository,
  FakePatreonPort,
  FakePatreonTierCatalog,
} from "@/infra/patreon/fake-patreon";
import type { Tier } from "../links/tier";
import { PatreonAccess } from "./connect";
import { RecordPatreonPledge, SetUpPatreonCampaign } from "./sync";

const NOW = new Date("2026-11-01T12:00:00Z");
const WEBHOOK_URI = "https://www.nightdaro.com/api/webhooks/patreon";

const ourTier = (
  id: string,
  name: string,
  priceCents: number,
  platform: Tier["platform"] = "patreon",
): Tier => ({
  id,
  platform,
  name,
  priceCents,
  currency: "USD",
  url: "https://www.patreon.com/cw/Ndaro",
  position: 0,
  benefits: [],
  highlighted: false,
  patreonTierId: null,
});

let patreon: FakePatreonPort;
let connections: FakePatreonConnectionRepository;
let catalog: FakePatreonTierCatalog;
let members: FakePatreonMemberRepository;
let tiers: FakeTierRepository;

const setUp = () =>
  new SetUpPatreonCampaign({
    patreon,
    access: new PatreonAccess(patreon, connections, () => NOW),
    connections,
    catalog,
    members,
    tiers,
    webhookUri: WEBHOOK_URI,
  });

beforeEach(async () => {
  patreon = new FakePatreonPort();
  connections = new FakePatreonConnectionRepository();
  catalog = new FakePatreonTierCatalog();
  members = new FakePatreonMemberRepository();
  tiers = new FakeTierRepository();
  await connections.save({
    campaignId: "camp-1",
    campaignUrl: "https://www.patreon.com/cw/Ndaro",
    tokens: {
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: new Date(NOW.getTime() + 3_600_000),
    },
    webhook: null,
    connectedAt: NOW,
  });
});

describe("SetUpPatreonCampaign", () => {
  it("stores Patreon's tiers and links ours by price, then by name; other platforms are left alone", async () => {
    await tiers.save(ourTier("a", "Support", 500));
    await tiers.save({ ...ourTier("b", "Advanced support", 1200), position: 1 });
    await tiers.save({ ...ourTier("c", "VIP", 500, "fansly"), position: 2 });

    await setUp().execute();

    expect(catalog.tiers.map((t) => t.id)).toEqual(["pt-5", "pt-10"]);
    expect((await tiers.findById("a"))?.patreonTierId).toBe("pt-5");
    // No tier of ours costs 10: the name matches instead.
    expect((await tiers.findById("b"))?.patreonTierId).toBe("pt-10");
    expect((await tiers.findById("c"))?.patreonTierId).toBeNull();
  });

  it("keeps a link chosen by hand and never links two of our tiers to the same Patreon tier", async () => {
    await tiers.save({ ...ourTier("a", "Mine", 900), patreonTierId: "pt-10" });
    await tiers.save({ ...ourTier("b", "Other", 1000), position: 1 });

    await setUp().execute();

    expect((await tiers.findById("a"))?.patreonTierId).toBe("pt-10");
    expect((await tiers.findById("b"))?.patreonTierId).toBeNull();
  });

  it("drops a link to a Patreon tier that no longer exists", async () => {
    await tiers.save({ ...ourTier("a", "Old", 700), patreonTierId: "pt-gone" });
    await setUp().execute();
    expect((await tiers.findById("a"))?.patreonTierId).toBeNull();
  });

  it("creates the webhook once with the pledge and post triggers, and stores its secret", async () => {
    await setUp().execute();
    await setUp().execute();

    expect([...patreon.webhooks.values()]).toEqual([
      {
        uri: WEBHOOK_URI,
        triggers: [
          "members:pledge:create",
          "members:pledge:update",
          "members:pledge:delete",
          "posts:publish",
        ],
      },
    ]);
    expect((await connections.get())?.webhook).toEqual({ id: "wh-1", secret: "secret-wh-1" });
  });

  it("deletes a leftover webhook pointing at our URL before creating the new one", async () => {
    await patreon.createWebhook("at", {
      campaignId: "camp-1",
      uri: WEBHOOK_URI,
      triggers: ["posts:publish"],
    });
    await patreon.createWebhook("at", {
      campaignId: "camp-1",
      uri: "https://elsewhere.example/hook",
      triggers: ["posts:publish"],
    });

    await setUp().execute();

    expect([...patreon.webhooks.values()].map((w) => w.uri).sort()).toEqual([
      "https://elsewhere.example/hook",
      WEBHOOK_URI,
    ]);
    expect(patreon.webhooks.has("wh-1")).toBe(false);
  });

  it("replaces the members with Patreon's current list", async () => {
    await members.save({
      id: "stale",
      status: "active_patron",
      amountCents: 500,
      tierIds: [],
      pledgeStart: null,
    });
    patreon.members = [
      { id: "m1", status: "active_patron", amountCents: 500, tierIds: ["pt-5"], pledgeStart: NOW },
    ];

    await setUp().execute();

    expect((await members.list()).map((m) => m.id)).toEqual(["m1"]);
  });
});

const pledge = (events: FakePatreonEventRepository) =>
  new RecordPatreonPledge({
    patreon,
    access: new PatreonAccess(patreon, connections, () => NOW),
    members,
    events,
    clock: () => NOW,
  });

describe("RecordPatreonPledge", () => {
  const member = {
    id: "m1",
    status: "active_patron" as const,
    amountCents: 1000,
    tierIds: ["pt-10"],
    pledgeStart: NOW,
  };

  it("records the event with its kind and updates the member", async () => {
    patreon.members = [member];
    const events = new FakePatreonEventRepository();
    const record = pledge(events);

    await record.execute({ trigger: "members:pledge:create", key: "k1", member });

    expect(events.events).toEqual([
      {
        key: "k1",
        kind: "alta",
        memberId: "m1",
        amountCents: 1000,
        patreonTierId: "pt-10",
        occurredAt: NOW,
      },
    ]);
    expect(await members.list()).toEqual([member]);
  });

  it("ignores a retried delivery and maps update and delete", async () => {
    patreon.members = [{ ...member, status: "former_patron", amountCents: 0, tierIds: [] }];
    const events = new FakePatreonEventRepository();
    const record = pledge(events);

    await record.execute({ trigger: "members:pledge:create", key: "k1", member });
    await record.execute({ trigger: "members:pledge:create", key: "k1", member });
    await record.execute({ trigger: "members:pledge:update", key: "k2", member });
    await record.execute({
      trigger: "members:pledge:delete",
      key: "k3",
      member: { ...member, status: "former_patron", amountCents: 0, tierIds: [] },
    });

    expect(events.events.map((e) => e.kind)).toEqual(["alta", "cambio", "baja"]);
    expect((await members.list())[0]).toMatchObject({ status: "former_patron", amountCents: 0 });
  });

  it("stores Patreon's current state, so a late retried alta does not revive a former patron", async () => {
    patreon.members = [{ ...member, status: "former_patron", amountCents: 0, tierIds: [] }];
    const events = new FakePatreonEventRepository();

    await pledge(events).execute({ trigger: "members:pledge:create", key: "late", member });

    expect((await members.list())[0]).toMatchObject({ status: "former_patron" });
    expect(events.events.map((e) => e.kind)).toEqual(["alta"]);
  });

  it("marks a member Patreon no longer has as former, and falls back to the payload when Patreon fails", async () => {
    patreon.members = [];
    await pledge(new FakePatreonEventRepository()).execute({
      trigger: "members:pledge:delete",
      key: "gone",
      member,
    });
    expect((await members.list())[0]).toMatchObject({
      status: "former_patron",
      amountCents: 0,
      tierIds: [],
    });

    patreon.getMember = async () => {
      throw new Error("Patreon is down");
    };
    await pledge(new FakePatreonEventRepository()).execute({
      trigger: "members:pledge:create",
      key: "down",
      member,
    });
    expect((await members.list())[0]).toEqual(member);
  });

  it("saves the member before the event, so a failed save is retried by Patreon", async () => {
    patreon.members = [member];
    const events = new FakePatreonEventRepository();
    const realSave = members.save.bind(members);
    members.save = async () => {
      throw new Error("db down");
    };
    await expect(
      pledge(events).execute({ trigger: "members:pledge:create", key: "k", member }),
    ).rejects.toThrow();
    expect(events.events).toEqual([]);

    members.save = realSave;
    await pledge(events).execute({ trigger: "members:pledge:create", key: "k", member });
    expect(events.events).toHaveLength(1);
    expect(await members.list()).toEqual([member]);
  });

  it("rejects a trigger that is not a pledge", async () => {
    const record = pledge(new FakePatreonEventRepository());
    await expect(record.execute({ trigger: "posts:publish", key: "k", member })).rejects.toThrow(
      /pledge/,
    );
  });
});
