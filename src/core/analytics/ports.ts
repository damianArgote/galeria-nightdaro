import type { AnalyticsEvent } from "./analytics-event";
import type { DateRange, SummaryCounts } from "./analytics-summary";

export interface EventRepository {
  record(event: AnalyticsEvent): Promise<void>;
  /** Aggregates for the range; `daily` only lists days that have events. */
  summarize(range: DateRange, topArtworks: number): Promise<SummaryCounts>;
}
