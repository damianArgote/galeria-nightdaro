export interface TrackingLink {
  id: string;
  /** Public path segment: /r/{code}. */
  code: string;
  targetUrl: string;
  label: string;
  tierId: string | null;
}
