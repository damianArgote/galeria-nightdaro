import type { AnalyticsEvent } from "@/core/analytics/analytics-event";
import type { DateRange, SummaryCounts } from "@/core/analytics/analytics-summary";
import type { EventRepository } from "@/core/analytics/ports";

/** In-memory EventRepository for tests: records events; summaries are canned. */
export class FakeEventRepository implements EventRepository {
  readonly recorded: AnalyticsEvent[] = [];
  counts: SummaryCounts = {
    visits: 0,
    uniqueVisitors: 0,
    ageGateSessions: 0,
    clicks: 0,
    clickingSessions: 0,
    clicksByTier: [],
    clicksByLink: [],
    daily: [],
    topArtworks: [],
  };
  lastRange: DateRange | undefined;

  async record(event: AnalyticsEvent): Promise<void> {
    this.recorded.push({ ...event });
  }

  async summarize(range: DateRange): Promise<SummaryCounts> {
    this.lastRange = range;
    return this.counts;
  }
}
