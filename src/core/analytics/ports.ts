import type { AnalyticsEvent } from "./analytics-event";
import type { DateRange, SummaryCounts } from "./analytics-summary";

export interface EventRepository {
  record(event: AnalyticsEvent): Promise<void>;
  /** Whether this session already clicked this link (or this artwork's button) since `since`. */
  hasClickSince(
    sessionHash: string,
    target: { linkId: string } | { artworkId: string },
    since: Date,
  ): Promise<boolean>;
  /** Aggregates for the range; `daily` only lists days that have events. */
  summarize(range: DateRange, topArtworks: number): Promise<SummaryCounts>;
}
