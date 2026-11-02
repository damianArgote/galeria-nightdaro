import { z } from "zod";
import type { ArtworkRepository } from "../artworks/artwork-repository";
import type { TrackingLinkRepository } from "../links/link-repositories";
import { systemClock, type Clock } from "../shared/clock";
import type { VisitorContext } from "./analytics-event";
import type { EventRepository } from "./ports";

/** What the browser may report; clicks are recorded by /r/{code}, never by the client. */
export const clientEventSchema = z.object({
  type: z.enum(["view", "age_ok"]),
  artworkId: z.uuid().optional(),
  referrer: z.string().max(2000).optional(),
});
export type ClientEventInput = z.input<typeof clientEventSchema>;

const IPV4_HOST = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Keeps only the host of an absolute http(s) URL; a bare IP host is dropped (no IPs, ever). */
export function referrerHost(referrer: string | undefined | null): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // IPv6 hosts come bracketed: [2001:db8::1].
    if (IPV4_HOST.test(url.hostname) || url.hostname.startsWith("[")) return null;
    return url.hostname.slice(0, 255);
  } catch {
    return null;
  }
}

const countryCode = (country: string | null) =>
  country && /^[A-Z]{2}$/.test(country) ? country : null;

/** Records a page view, an artwork view or an age gate acceptance sent by the browser. */
export class RecordClientEvent {
  constructor(
    private readonly events: EventRepository,
    private readonly artworks: ArtworkRepository,
  ) {}

  async execute(input: ClientEventInput, visitor: VisitorContext): Promise<void> {
    const event = clientEventSchema.parse(input);

    // Only published artworks count; anything else becomes a plain page view.
    let artworkId: string | null = null;
    if (event.type === "view" && event.artworkId) {
      const artwork = await this.artworks.findById(event.artworkId);
      if (artwork?.status === "published") artworkId = artwork.id;
    }

    await this.events.record({
      type: event.type,
      artworkId,
      linkId: null,
      sessionHash: visitor.sessionHash,
      referrer: referrerHost(event.referrer),
      country: countryCode(visitor.country),
      locale: visitor.locale,
    });
  }
}

/** Repeated clicks (double clicks, browser prefetch + navigation) count once in this window. */
export const CLICK_DEDUP_MS = 30_000;

/** /r/{code}: records the click and returns where to send the visitor, or null. */
export class RecordClick {
  constructor(
    private readonly events: EventRepository,
    private readonly links: TrackingLinkRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(
    { code, referrer }: { code: string; referrer?: string | null },
    visitor: VisitorContext | null,
  ): Promise<string | null> {
    const link = await this.links.findByCode(code);
    if (!link) return null;
    const now = this.clock();
    const since = new Date(now.getTime() - CLICK_DEDUP_MS);
    if (
      visitor &&
      !(await this.events.hasClickSince(visitor.sessionHash, { linkId: link.id }, since))
    ) {
      await this.events.record({
        occurredAt: now,
        type: "click",
        artworkId: null,
        linkId: link.id,
        sessionHash: visitor.sessionHash,
        referrer: referrerHost(referrer),
        country: countryCode(visitor.country),
        locale: visitor.locale,
      });
    }
    return link.targetUrl;
  }
}

/**
 * /r/obra/{id}: "Ver completa en Patreon" from an artwork. Records which artwork sent the
 * visitor (so the Resumen knows which artworks lead to Patreon) and returns its post, or null.
 */
export class RecordArtworkClick {
  constructor(
    private readonly events: EventRepository,
    private readonly artworks: ArtworkRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(
    { artworkId, referrer }: { artworkId: string; referrer?: string | null },
    visitor: VisitorContext | null,
  ): Promise<string | null> {
    if (!z.uuid().safeParse(artworkId).success) return null;
    const artwork = await this.artworks.findById(artworkId);
    if (!artwork || artwork.status !== "published" || !artwork.patreonPostUrl) return null;

    const now = this.clock();
    const since = new Date(now.getTime() - CLICK_DEDUP_MS);
    if (visitor && !(await this.events.hasClickSince(visitor.sessionHash, { artworkId }, since))) {
      await this.events.record({
        occurredAt: now,
        type: "click",
        artworkId,
        linkId: null,
        sessionHash: visitor.sessionHash,
        referrer: referrerHost(referrer),
        country: countryCode(visitor.country),
        locale: visitor.locale,
      });
    }
    return artwork.patreonPostUrl;
  }
}
