import type { z } from "zod";
import { NotFoundError } from "../shared/errors";
import type { TrackingLinkRepository } from "./link-repositories";
import { linkIdSchema } from "./link-schemas";

export const deleteTrackingLinkSchema = linkIdSchema;
export type DeleteTrackingLinkInput = z.input<typeof deleteTrackingLinkSchema>;

export class DeleteTrackingLink {
  constructor(private readonly links: TrackingLinkRepository) {}

  async execute(input: DeleteTrackingLinkInput): Promise<void> {
    const { id } = deleteTrackingLinkSchema.parse(input);
    if (!(await this.links.findById(id))) throw new NotFoundError("TrackingLink", id);
    await this.links.delete(id);
  }
}
