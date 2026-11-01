import { z } from "zod";
import type { ArtworkRepository } from "../artworks/artwork-repository";
import type { TrackingLinkRepository } from "../links/link-repositories";
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
    });
  }
}

/** /r/{code}: records the click and returns where to send the visitor, or null. */
export class RecordClick {
  constructor(
    private readonly events: EventRepository,
    private readonly links: TrackingLinkRepository,
  ) {}

  async execute(
    { code, referrer }: { code: string; referrer?: string | null },
    visitor: VisitorContext | null,
  ): Promise<string | null> {
    const link = await this.links.findByCode(code);
    if (!link) return null;
    if (visitor) {
      await this.events.record({
        type: "click",
        artworkId: null,
        linkId: link.id,
        sessionHash: visitor.sessionHash,
        referrer: referrerHost(referrer),
        country: countryCode(visitor.country),
      });
    }
    return link.targetUrl;
  }
}
