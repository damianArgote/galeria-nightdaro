/** Inclusive day range, YYYY-MM-DD in the analytics time zone. */
export interface DateRange {
  from: string;
  to: string;
}

export interface SummaryCounts {
  /** Page views (views without an artwork). */
  visits: number;
  uniqueVisitors: number;
  /** Distinct sessions that accepted the age gate. */
  ageGateSessions: number;
  clicks: number;
  /** Distinct sessions with at least one click. */
  clickingSessions: number;
  clicksByTier: { tierId: string; name: string; platform: string; clicks: number }[];
  /** Tracking links without a tier (social bios, campaigns…). */
  clicksByLink: { linkId: string; label: string; clicks: number }[];
  daily: { day: string; visits: number; clicks: number }[];
  topArtworks: { artworkId: string; title: string; slug: string; views: number }[];
}

export interface AnalyticsSummary extends SummaryCounts {
  range: DateRange;
  /** Share of unique visitors that accepted the age gate (0..1). */
  ageGateRate: number;
  /** Share of unique visitors that clicked a tier or link (0..1). */
  conversion: number;
}
