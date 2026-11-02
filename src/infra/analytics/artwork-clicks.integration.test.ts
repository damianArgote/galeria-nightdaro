import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GetAnalyticsSummary } from "@/core/analytics/get-analytics-summary";
import { RecordArtworkClick, RecordClientEvent } from "@/core/analytics/record-event";
import { CreateArtwork } from "@/core/artworks/create-artwork";
import { PublishArtwork } from "@/core/artworks/publish-artwork";
import { events } from "@/db/schema";
import { DrizzleArtworkRepository } from "@/infra/artworks/drizzle-artwork-repository";
import { createTestDb, databaseUrl } from "../../../tests/helpers/test-db";
import { DrizzleEventRepository } from "./drizzle-event-repository";

const visitor = (n: number) => ({
  sessionHash: String(n).repeat(32),
  country: "AR",
  locale: "en" as const,
});

describe.skipIf(!databaseUrl)("artworks that lead to Patreon, against Postgres", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let repo: DrizzleEventRepository;

  beforeAll(async () => {
    testDb = await createTestDb("analytics_artworks");
    await testDb.reset();
    repo = new DrizzleEventRepository(testDb.db);
    const artworks = new DrizzleArtworkRepository(testDb.db);
    const make = async (title: string, patreonPostUrl: string | null) => {
      const created = await new CreateArtwork(artworks).execute({
        title,
        kind: "finished",
        rating: "sfw",
        patreonPostUrl,
      });
      await new PublishArtwork(artworks).execute({ id: created.id });
      return created;
    };
    const calabaza = await make("Calabaza", "https://www.patreon.com/posts/calabaza-1");
    const kitsune = await make("Kitsune", "https://www.patreon.com/posts/kitsune-2");
    const view = new RecordClientEvent(repo, artworks);
    const click = new RecordArtworkClick(repo, artworks);

    // Calabaza: 3 viewers, 2 go to Patreon. Kitsune: 2 viewers, 1 goes to Patreon.
    for (const n of [1, 2, 3])
      await view.execute({ type: "view", artworkId: calabaza.id }, visitor(n));
    for (const n of [1, 2]) await click.execute({ artworkId: calabaza.id }, visitor(n));
    for (const n of [4, 5]) await view.execute({ type: "view", artworkId: kitsune.id }, visitor(n));
    await click.execute({ artworkId: kitsune.id }, visitor(4));
    await testDb.db.update(events).set({ createdAt: new Date("2026-11-02T15:00:00Z") });
  });

  afterAll(async () => {
    await testDb?.close();
  });

  it("ranks artworks by clicks to their Patreon post, with their views", async () => {
    const summary = await new GetAnalyticsSummary(repo).execute({
      from: "2026-11-02",
      to: "2026-11-02",
    });

    expect(summary.artworkClicks).toEqual([
      expect.objectContaining({ title: "Calabaza", views: 3, clicks: 2 }),
      expect.objectContaining({ title: "Kitsune", views: 2, clicks: 1 }),
    ]);
    // Artwork clicks count as clicks to Patreon in the totals too.
    expect(summary).toMatchObject({ clicks: 3, clickingSessions: 3 });
  });
});
