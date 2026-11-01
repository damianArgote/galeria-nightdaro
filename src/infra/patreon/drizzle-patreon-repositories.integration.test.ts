import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PatreonEvent } from "@/core/patreon/patreon";
import { createTestDb, databaseUrl } from "../../../tests/helpers/test-db";
import {
  DrizzlePatreonEventRepository,
  DrizzlePatreonMemberRepository,
  DrizzlePatreonTierCatalog,
} from "./drizzle-patreon-repositories";

const NOW = new Date("2026-11-01T12:00:00Z");

describe.skipIf(!databaseUrl)("Patreon tiers, members and events against Postgres", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;

  beforeAll(async () => {
    testDb = await createTestDb("patreon_data");
  });
  beforeEach(async () => {
    await testDb.reset();
  });
  afterAll(async () => {
    await testDb?.close();
  });

  it("replaces the tier catalog keeping Patreon's order", async () => {
    const catalog = new DrizzlePatreonTierCatalog(testDb.db);
    await catalog.replace([{ id: "old", title: "Old", amountCents: 300, url: null }]);
    await catalog.replace([
      {
        id: "pt-10",
        title: "Advanced support",
        amountCents: 1000,
        url: "https://www.patreon.com/x",
      },
      { id: "pt-5", title: "Support", amountCents: 500, url: null },
    ]);
    expect((await catalog.list()).map((t) => t.id)).toEqual(["pt-10", "pt-5"]);
  });

  it("upserts members and replaces them all on a full sync", async () => {
    const members = new DrizzlePatreonMemberRepository(testDb.db);
    const m1 = {
      id: "m1",
      status: "active_patron" as const,
      amountCents: 500,
      tierIds: ["pt-5"],
      pledgeStart: NOW,
    };
    await members.save(m1);
    await members.save({ ...m1, amountCents: 1000, tierIds: ["pt-10"] });
    expect(await members.list()).toEqual([{ ...m1, amountCents: 1000, tierIds: ["pt-10"] }]);

    await members.replaceAll([{ ...m1, id: "m2" }]);
    expect((await members.list()).map((m) => m.id)).toEqual(["m2"]);
  });

  it("records an event once per key", async () => {
    const events = new DrizzlePatreonEventRepository(testDb.db);
    const event: PatreonEvent = {
      key: "k1",
      kind: "alta",
      memberId: "m1",
      amountCents: 500,
      patreonTierId: "pt-5",
      occurredAt: NOW,
    };
    expect(await events.recordOnce(event)).toBe(true);
    expect(await events.recordOnce({ ...event, kind: "baja" })).toBe(false);
  });
});
