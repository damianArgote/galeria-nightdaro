export const EVENT_TYPES = ["view", "click", "age_ok"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * One visitor action. There is no IP anywhere: `sessionHash` is a daily, salted hash computed
 * before the event reaches the core, and `country` is a two-letter code from the CDN.
 */
export interface AnalyticsEvent {
  type: EventType;
  /** view of an artwork (lightbox or detail page); null for a page view. */
  artworkId: string | null;
  /** click on a tracking link. */
  linkId: string | null;
  sessionHash: string;
  /** Host of the referring site, never the full URL. */
  referrer: string | null;
  country: string | null;
}

/** Where a visitor came from: who they are is never part of it. */
export interface VisitorContext {
  sessionHash: string;
  country: string | null;
}
