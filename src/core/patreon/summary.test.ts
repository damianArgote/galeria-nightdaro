import { describe, expect, it } from "vitest";
import { FakeTierRepository } from "@/infra/links/fake-link-repositories";
import {
  FakePatreonEventRepository,
  FakePatreonMemberRepository,
  FakePatreonTierCatalog,
} from "@/infra/patreon/fake-patreon";
import type { Tier } from "../links/tier";
import type { PatreonEvent } from "./patreon";
import { GetPatreonSummary } from "./summary";

const event = (
  kind: PatreonEvent["kind"],
  tier: string | null,
  at: string,
  key = `${kind}-${tier}-${at}`,
): PatreonEvent => ({
  key,
  kind,
  memberId: key,
  amountCents: 500,
  patreonTierId: tier,
  occurredAt: new Date(at),
});

const ours = (id: string, name: string, patreonTierId: string | null): Tier => ({
  id,
  platform: "patreon",
  name,
  priceCents: 500,
  currency: "USD",
  url: "https://www.patreon.com/cw/Ndaro",
  position: 0,
  benefits: [],
  highlighted: false,
  patreonTierId,
});

async function setUp() {
  const events = new FakePatreonEventRepository();
  const members = new FakePatreonMemberRepository();
  const catalog = new FakePatreonTierCatalog();
  const tiers = new FakeTierRepository();
  await catalog.replace([
    { id: "pt-5", title: "Support", amountCents: 500, url: null },
    { id: "pt-10", title: "Advanced support", amountCents: 1000, url: null },
  ]);
  await tiers.save(ours("our-5", "Support", "pt-5"));
  await tiers.save({ ...ours("our-10", "Avanzado", null), position: 1 });
  return {
    events,
    members,
    catalog,
    tiers,
    summary: new GetPatreonSummary(events, members, catalog, tiers),
  };
}

describe("GetPatreonSummary", () => {
  it("counts new and ended pledges in the range, in Buenos Aires days", async () => {
    const { events, summary } = await setUp();
    events.events.push(
      event("alta", "pt-5", "2026-11-01T02:59:00Z"), // still Oct 31 in Buenos Aires
      event("alta", "pt-5", "2026-11-01T03:00:00Z"),
      event("alta", "pt-10", "2026-11-02T12:00:00Z"),
      event("baja", "pt-5", "2026-11-03T12:00:00Z"),
      event("cambio", "pt-10", "2026-11-03T12:00:00Z"),
    );

    const result = await summary.execute({ from: "2026-11-01", to: "2026-11-30" });

    expect(result).toMatchObject({ altas: 2, bajas: 1 });
  });

  it("reports active patrons and the estimated monthly income from current members", async () => {
    const { members, summary } = await setUp();
    await members.replaceAll([
      { id: "a", status: "active_patron", amountCents: 500, tierIds: ["pt-5"], pledgeStart: null },
      {
        id: "b",
        status: "active_patron",
        amountCents: 1000,
        tierIds: ["pt-10"],
        pledgeStart: null,
      },
      {
        id: "c",
        status: "declined_patron",
        amountCents: 1000,
        tierIds: ["pt-10"],
        pledgeStart: null,
      },
      { id: "d", status: "former_patron", amountCents: 0, tierIds: [], pledgeStart: null },
    ]);

    const result = await summary.execute({ from: "2026-11-01", to: "2026-11-30" });

    expect(result).toMatchObject({ activePatrons: 2, monthlyIncomeCents: 1500 });
  });

  it("lists each Patreon tier with its link to ours, active patrons and new pledges", async () => {
    const { events, members, summary } = await setUp();
    events.events.push(event("alta", "pt-10", "2026-11-02T12:00:00Z"));
    await members.replaceAll([
      { id: "a", status: "active_patron", amountCents: 500, tierIds: ["pt-5"], pledgeStart: null },
    ]);

    const result = await summary.execute({ from: "2026-11-01", to: "2026-11-30" });

    expect(result.byTier).toEqual([
      { patreonTierId: "pt-5", title: "Support", tierId: "our-5", active: 1, altas: 0 },
      { patreonTierId: "pt-10", title: "Advanced support", tierId: null, active: 0, altas: 1 },
    ]);
  });
});
