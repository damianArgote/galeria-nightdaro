import type { ArtworkRepository } from "./artwork-repository";
import { slugify } from "./slug";

/** Slug for the title that no other artwork uses: "noche", "noche-2", "noche-3"… */
export async function uniqueSlug(
  repository: ArtworkRepository,
  title: string,
  ownId?: string,
): Promise<string> {
  const base = slugify(title) || "obra";
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const existing = await repository.findBySlug(candidate);
    if (!existing || existing.id === ownId) return candidate;
  }
}
