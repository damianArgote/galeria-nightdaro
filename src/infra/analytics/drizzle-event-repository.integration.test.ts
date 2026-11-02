import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GetAnalyticsSummary } from "@/core/analytics/get-analytics-summary";
import { RecordClick, RecordClientEvent } from "@/core/analytics/record-event";
import { CreateArtwork } from "@/core/artworks/create-artwork";
import { PublishArtwork } from "@/core/artworks/publish-artwork";
import { CreateTier } from "@/core/links/create-tier";
import { CreateTrackingLink } from "@/core/links/create-tracking-link";
import { events } from "@/db/schema";
import { DrizzleArtworkRepository } from "@/infra/artworks/drizzle-artwork-repository";
import {
  DrizzleTierRepository,
  DrizzleTrackingLinkRepository,
} from "@/infra/links/drizzle-link-repositories";
import { createTestDb, databaseUrl } from "../../../tests/helpers/test-db";
import { DrizzleEventRepository } from "./drizzle-event-repository";
import { visitorFrom } from "./visitor";

const IP_A = "203.0.113.7";
const IP_B = "198.51.100.23";
const headersFor = (ip: string, cookie = "") =>
  new Headers({
    "x-forwarded-for": ip,
    "user-agent": "Mozilla/5.0 Chrome/130",
    "cf-ipcountry": "AR",
    cookie,
  });

describe.skipIf(!databaseUrl)("analytics against Postgres", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let repo: DrizzleEventRepository;

  beforeAll(async () => {
    testDb = await createTestDb("analytics");
    await testDb.reset();
    repo = new DrizzleEventRepository(testDb.db);

    const artworks = new DrizzleArtworkRepository(testDb.db);
    const tiers = new DrizzleTierRepository(testDb.db);
    const links = new DrizzleTrackingLinkRepository(testDb.db);
    const obra = await new CreateArtwork(artworks).execute({
      title: "Obra vista",
      kind: "finished",
      rating: "sfw",
    });
    await new PublishArtwork(artworks).execute({ id: obra.id });
    const tinta = await new CreateTier(tiers, links).execute({
      platform: "patreon",
      name: "Tinta",
      priceCents: 700,
      url: "https://www.patreon.com/cw/Ndaro",
    });
    await new CreateTrackingLink(links, tiers).execute({
      label: "Bio de X",
      code: "x-bio",
      targetUrl: "https://www.patreon.com/cw/Ndaro",
    });
    const tierCode = (await links.list()).find((l) => l.tierId === tinta.id)!.code;

    const at = (iso: string) => new Date(iso);
    const a = visitorFrom(headersFor(IP_A), at("2026-10-30T15:00:00Z"));
    const b = visitorFrom(headersFor(IP_B, "lang=es"), at("2026-10-30T15:00:00Z"));
    const record = new RecordClientEvent(repo, artworks);
    const click = new RecordClick(repo, links);

    // Visitor A: two page views, one artwork view, accepts the gate, clicks the tier twice
    // in a row (counted once: same session, same link, within 30 s).
    await record.execute({ type: "view", referrer: "https://x.com/post" }, a);
    await record.execute({ type: "view" }, a);
    await record.execute({ type: "view", artworkId: obra.id }, a);
    await record.execute({ type: "age_ok" }, a);
    await click.execute({ code: tierCode }, a);
    await click.execute({ code: tierCode }, a);
    // Visitor B, browsing in Spanish: one page view and a click on a social link.
    await record.execute({ type: "view" }, b);
    await click.execute({ code: "x-bio" }, b);

    // Timestamps: 2026-10-30 15:00 ART, and 2026-10-31 02:30 UTC = 2026-10-30 23:30 ART.
    await testDb.db.update(events).set({ createdAt: at("2026-10-30T18:00:00Z") });
    await testDb.db.execute(
      sql`update events set created_at = '2026-10-31T02:30:00Z' where id = (select id from events where type = 'click' and link_id is not null order by created_at limit 1)`,
    );
  });

  afterAll(async () => {
    await testDb?.close();
  });

  it("summarizes visits, sessions, clicks and top artworks by Argentina day", async () => {
    const summary = await new GetAnalyticsSummary(repo).execute({
      from: "2026-10-30",
      to: "2026-10-31",
    });

    expect(summary).toMatchObject({
      visits: 3,
      uniqueVisitors: 2,
      ageGateSessions: 1,
      clicks: 2,
      clickingSessions: 2,
      ageGateRate: 0.5,
      conversion: 1,
      clicksByTier: [{ name: "Tinta", platform: "patreon", clicks: 1 }],
      clicksByLink: [{ label: "Bio de X", clicks: 1 }],
      topArtworks: [{ title: "Obra vista", views: 1 }],
      visitsByLocale: [
        { locale: "en", visits: 2, uniqueVisitors: 1 },
        { locale: "es", visits: 1, uniqueVisitors: 1 },
      ],
    });
    // The 02:30 UTC click still belongs to October 30 in Buenos Aires.
    expect(summary.daily).toEqual([
      { day: "2026-10-30", visits: 3, clicks: 2 },
      { day: "2026-10-31", visits: 0, clicks: 0 },
    ]);
  });

  it("leaves days outside the range out", async () => {
    const summary = await new GetAnalyticsSummary(repo).execute({
      from: "2026-10-31",
      to: "2026-11-01",
    });

    expect(summary).toMatchObject({ visits: 0, clicks: 0, uniqueVisitors: 0 });
  });

  it("stores no IP address anywhere in the events table", async () => {
    const rows = await testDb.db.execute<{ row: string }>(
      sql`select row_to_json(e)::text as row from events e`,
    );
    const columns = await testDb.db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns where table_name = 'events'`,
    );

    expect(rows.length).toBe(7);
    for (const { row } of rows) {
      for (const ip of [IP_A, IP_B]) {
        expect(row).not.toContain(ip);
        expect(row).not.toContain(ip.replaceAll(".", ""));
      }
    }
    expect(columns.map((c) => c.column_name).filter((c) => /ip|addr/i.test(c))).toEqual([]);
  });
});
