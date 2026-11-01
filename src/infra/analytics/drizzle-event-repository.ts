import { and, eq, gte, sql } from "drizzle-orm";
import type { AnalyticsEvent } from "@/core/analytics/analytics-event";
import type { DateRange, SummaryCounts } from "@/core/analytics/analytics-summary";
import type { EventRepository } from "@/core/analytics/ports";
import type { Db } from "@/db/client";
import { events } from "@/db/schema";

/** Days are counted in Daro's time zone. */
export const ANALYTICS_TIME_ZONE = "America/Argentina/Buenos_Aires";

const n = (value: unknown) => Number(value ?? 0);

export class DrizzleEventRepository implements EventRepository {
  constructor(private readonly db: Db) {}

  async record({ occurredAt, ...event }: AnalyticsEvent): Promise<void> {
    await this.db.insert(events).values({ ...event, ...(occurredAt && { createdAt: occurredAt }) });
  }

  async hasClickSince(sessionHash: string, linkId: string, since: Date): Promise<boolean> {
    const [row] = await this.db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.type, "click"),
          eq(events.sessionHash, sessionHash),
          eq(events.linkId, linkId),
          gte(events.createdAt, since),
        ),
      )
      .limit(1);
    return !!row;
  }

  async summarize({ from, to }: DateRange, topArtworks: number): Promise<SummaryCounts> {
    const tz = ANALYTICS_TIME_ZONE;
    // [from 00:00, to + 1 day 00:00) in the analytics time zone.
    const inRange = sql`e.created_at >= (${from}::date)::timestamp at time zone ${tz}
      and e.created_at < ((${to}::date + 1))::timestamp at time zone ${tz}`;

    const [totals] = await this.db.execute<Record<string, unknown>>(sql`
      select
        count(*) filter (where e.type = 'view' and e.artwork_id is null) as visits,
        count(distinct e.session_hash) filter (where e.type = 'view' and e.artwork_id is null) as unique_visitors,
        count(distinct e.session_hash) filter (where e.type = 'age_ok') as age_gate_sessions,
        count(*) filter (where e.type = 'click') as clicks,
        count(distinct e.session_hash) filter (where e.type = 'click') as clicking_sessions
      from events e where ${inRange}`);

    const byTier = await this.db.execute<Record<string, unknown>>(sql`
      select t.id, t.name, t.platform, count(*) as clicks
      from events e join tracking_links l on l.id = e.link_id join tiers t on t.id = l.tier_id
      where e.type = 'click' and ${inRange}
      group by t.id, t.name, t.platform order by clicks desc, t.name`);

    const byLink = await this.db.execute<Record<string, unknown>>(sql`
      select l.id, l.label, count(*) as clicks
      from events e join tracking_links l on l.id = e.link_id
      where e.type = 'click' and l.tier_id is null and ${inRange}
      group by l.id, l.label order by clicks desc, l.label`);

    const daily = await this.db.execute<Record<string, unknown>>(sql`
      select to_char((e.created_at at time zone ${tz})::date, 'YYYY-MM-DD') as day,
        count(*) filter (where e.type = 'view' and e.artwork_id is null) as visits,
        count(*) filter (where e.type = 'click') as clicks
      from events e where ${inRange} group by 1 order by 1`);

    const top = await this.db.execute<Record<string, unknown>>(sql`
      select a.id, a.title, a.slug, count(*) as views
      from events e join artworks a on a.id = e.artwork_id
      where e.type = 'view' and ${inRange}
      group by a.id, a.title, a.slug order by views desc, a.title limit ${topArtworks}`);

    return {
      visits: n(totals?.visits),
      uniqueVisitors: n(totals?.unique_visitors),
      ageGateSessions: n(totals?.age_gate_sessions),
      clicks: n(totals?.clicks),
      clickingSessions: n(totals?.clicking_sessions),
      clicksByTier: byTier.map((r) => ({
        tierId: String(r.id),
        name: String(r.name),
        platform: String(r.platform),
        clicks: n(r.clicks),
      })),
      clicksByLink: byLink.map((r) => ({
        linkId: String(r.id),
        label: String(r.label),
        clicks: n(r.clicks),
      })),
      daily: daily.map((r) => ({ day: String(r.day), visits: n(r.visits), clicks: n(r.clicks) })),
      topArtworks: top.map((r) => ({
        artworkId: String(r.id),
        title: String(r.title),
        slug: String(r.slug),
        views: n(r.views),
      })),
    };
  }
}
