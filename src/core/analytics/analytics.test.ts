import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { FakeEventRepository } from "@/infra/analytics/fake-event-repository";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import {
  FakeTierRepository,
  FakeTrackingLinkRepository,
} from "@/infra/links/fake-link-repositories";
import { CreateArtwork } from "../artworks/create-artwork";
import { PublishArtwork } from "../artworks/publish-artwork";
import { CreateTrackingLink } from "../links/create-tracking-link";
import { GetAnalyticsSummary } from "./get-analytics-summary";
import { RecordArtworkClick, RecordClick, RecordClientEvent, referrerHost } from "./record-event";

const visitor = { sessionHash: "a".repeat(32), country: "AR", locale: "es" as const };

let events: FakeEventRepository;
let artworks: FakeArtworkRepository;

beforeEach(() => {
  events = new FakeEventRepository();
  artworks = new FakeArtworkRepository();
});

describe("RecordClientEvent", () => {
  it("records page views, published artwork views and age gate acceptances", async () => {
    const draft = await new CreateArtwork(artworks).execute({
      title: "Borrador",
      kind: "finished",
      rating: "sfw",
    });
    const published = await new PublishArtwork(artworks).execute({
      id: (
        await new CreateArtwork(artworks).execute({
          title: "Obra",
          kind: "finished",
          rating: "sfw",
        })
      ).id,
    });
    const record = new RecordClientEvent(events, artworks);

    await record.execute(
      { type: "view", referrer: "https://x.com/nightcrowller3/status/1?ref=a" },
      visitor,
    );
    await record.execute({ type: "view", artworkId: published.id }, visitor);
    await record.execute({ type: "view", artworkId: draft.id }, visitor);
    await record.execute({ type: "age_ok" }, { ...visitor, country: "not-a-code" });

    expect(events.recorded).toEqual([
      {
        type: "view",
        artworkId: null,
        linkId: null,
        sessionHash: visitor.sessionHash,
        referrer: "x.com",
        country: "AR",
        locale: "es",
      },
      {
        type: "view",
        artworkId: published.id,
        linkId: null,
        sessionHash: visitor.sessionHash,
        referrer: null,
        country: "AR",
        locale: "es",
      },
      {
        type: "view",
        artworkId: null,
        linkId: null,
        sessionHash: visitor.sessionHash,
        referrer: null,
        country: "AR",
        locale: "es",
      },
      {
        type: "age_ok",
        artworkId: null,
        linkId: null,
        sessionHash: visitor.sessionHash,
        referrer: null,
        country: null,
        locale: "es",
      },
    ]);
  });

  it("does not let the browser report clicks or unknown types", async () => {
    const record = new RecordClientEvent(events, artworks);

    await expect(record.execute({ type: "click" } as never, visitor)).rejects.toThrow(ZodError);
    expect(events.recorded).toEqual([]);
  });

  it("keeps only the host of http(s) referrers", () => {
    expect(referrerHost("https://www.reddit.com/r/x/comments/1?utm=a")).toBe("www.reddit.com");
    expect(referrerHost("javascript:alert(1)")).toBeNull();
    expect(referrerHost("http://203.0.113.99/x")).toBeNull();
    expect(referrerHost("http://[2001:db8::1]:8080/x")).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
    expect(referrerHost("")).toBeNull();
  });
});

describe("RecordClick", () => {
  it("records the click on the link and returns its target", async () => {
    const links = new FakeTrackingLinkRepository();
    const link = await new CreateTrackingLink(links, new FakeTierRepository()).execute({
      label: "Patreon",
      code: "patreon-1",
      targetUrl: "https://www.patreon.com/cw/Ndaro",
    });
    const click = new RecordClick(events, links);

    await expect(
      click.execute({ code: "patreon-1", referrer: "https://nightdaro.com/apoyar" }, visitor),
    ).resolves.toBe("https://www.patreon.com/cw/Ndaro");
    await expect(click.execute({ code: "missing" }, visitor)).resolves.toBeNull();
    // Crawlers follow the link without being counted.
    await expect(click.execute({ code: "patreon-1" }, null)).resolves.toBe(
      "https://www.patreon.com/cw/Ndaro",
    );

    expect(events.recorded.map(({ occurredAt: _at, ...e }) => e)).toEqual([
      {
        type: "click",
        artworkId: null,
        linkId: link.id,
        sessionHash: visitor.sessionHash,
        referrer: "nightdaro.com",
        country: "AR",
        locale: "es",
      },
    ]);
  });
});

describe("RecordClick dedup", () => {
  it("counts the same visitor's clicks on a link once every 30 seconds", async () => {
    const links = new FakeTrackingLinkRepository();
    await new CreateTrackingLink(links, new FakeTierRepository()).execute({
      label: "Patreon",
      code: "patreon-1",
      targetUrl: "https://www.patreon.com/cw/Ndaro",
    });
    let now = new Date("2026-11-01T12:00:00.000Z");
    const click = new RecordClick(events, links, () => now);

    await click.execute({ code: "patreon-1" }, visitor);
    now = new Date("2026-11-01T12:00:29.000Z");
    await click.execute({ code: "patreon-1" }, visitor);
    await click.execute({ code: "patreon-1" }, { ...visitor, sessionHash: "b".repeat(32) });
    now = new Date("2026-11-01T12:00:31.000Z");
    await click.execute({ code: "patreon-1" }, visitor);

    expect(events.recorded.map((e) => e.sessionHash[0])).toEqual(["a", "b", "a"]);
  });
});

describe("GetAnalyticsSummary", () => {
  it("fills every day of the range and computes the rates over unique visitors", async () => {
    events.counts = {
      ...events.counts,
      visits: 40,
      uniqueVisitors: 20,
      ageGateSessions: 15,
      clicks: 6,
      clickingSessions: 5,
      daily: [{ day: "2026-10-30", visits: 40, clicks: 6 }],
    };

    const summary = await new GetAnalyticsSummary(events).execute({
      from: "2026-10-29",
      to: "2026-10-31",
    });

    expect(summary.daily).toEqual([
      { day: "2026-10-29", visits: 0, clicks: 0 },
      { day: "2026-10-30", visits: 40, clicks: 6 },
      { day: "2026-10-31", visits: 0, clicks: 0 },
    ]);
    expect(summary).toMatchObject({ ageGateRate: 0.75, conversion: 0.25 });
  });

  it("lists visits in English and in Spanish, zeros included", async () => {
    events.counts = {
      ...events.counts,
      visitsByLocale: [{ locale: "es", visits: 3, uniqueVisitors: 2 }],
    };

    const summary = await new GetAnalyticsSummary(events).execute({
      from: "2026-10-29",
      to: "2026-10-31",
    });

    expect(summary.visitsByLocale).toEqual([
      { locale: "en", visits: 0, uniqueVisitors: 0 },
      { locale: "es", visits: 3, uniqueVisitors: 2 },
    ]);
  });

  it("reports zero rates without visitors and rejects invalid ranges", async () => {
    const summary = new GetAnalyticsSummary(events);

    await expect(summary.execute({ from: "2026-11-01", to: "2026-11-01" })).resolves.toMatchObject({
      ageGateRate: 0,
      conversion: 0,
    });
    await expect(summary.execute({ from: "2026-11-02", to: "2026-11-01" })).rejects.toThrow(
      ZodError,
    );
    await expect(summary.execute({ from: "2024-01-01", to: "2026-11-01" })).rejects.toThrow(
      ZodError,
    );
    await expect(summary.execute({ from: "ayer", to: "hoy" })).rejects.toThrow(ZodError);
  });
});

describe("RecordArtworkClick", () => {
  const POST = "https://www.patreon.com/posts/calabaza-123";

  async function artwork(patreonPostUrl: string | null, publish = true) {
    const created = await new CreateArtwork(artworks).execute({
      title: `Obra ${Math.random()}`,
      kind: "finished",
      rating: "sfw",
      patreonPostUrl,
    });
    if (publish) await new PublishArtwork(artworks).execute({ id: created.id });
    return created;
  }

  it("records a click from this artwork and sends the visitor to its Patreon post", async () => {
    const { id } = await artwork(POST);
    let now = new Date("2026-11-02T12:00:00Z");
    const click = new RecordArtworkClick(events, artworks, () => now);

    await expect(
      click.execute({ artworkId: id, referrer: "https://www.nightdaro.com/obra/x" }, visitor),
    ).resolves.toBe(POST);
    // A double click counts once; crawlers are redirected without counting.
    now = new Date("2026-11-02T12:00:10Z");
    await click.execute({ artworkId: id }, visitor);
    await expect(click.execute({ artworkId: id }, null)).resolves.toBe(POST);

    expect(events.recorded.map(({ occurredAt: _at, ...e }) => e)).toEqual([
      {
        type: "click",
        artworkId: id,
        linkId: null,
        sessionHash: visitor.sessionHash,
        referrer: "www.nightdaro.com",
        country: "AR",
        locale: "es",
      },
    ]);
  });

  it("has nowhere to go for an unpublished artwork or one without a post", async () => {
    const click = new RecordArtworkClick(events, artworks);
    const draft = await artwork(POST, false);
    const noPost = await artwork(null);

    await expect(click.execute({ artworkId: draft.id }, visitor)).resolves.toBeNull();
    await expect(click.execute({ artworkId: noPost.id }, visitor)).resolves.toBeNull();
    await expect(click.execute({ artworkId: "not-a-uuid" }, visitor)).resolves.toBeNull();
    expect(events.recorded).toEqual([]);
  });
});
