import type { TrackingLinkRepository } from "./link-repositories";
import type { TrackingLink } from "./tracking-link";

export class ListTrackingLinks {
  constructor(private readonly links: TrackingLinkRepository) {}

  execute(): Promise<TrackingLink[]> {
    return this.links.list();
  }
}
