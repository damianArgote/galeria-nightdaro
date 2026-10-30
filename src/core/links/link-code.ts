import { ConflictError } from "../shared/errors";
import type { TierRepository, TrackingLinkRepository } from "./link-repositories";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Checks the code is free (or the link's own) and the tier exists. */
export async function assertLinkRefs(
  links: TrackingLinkRepository,
  tiers: TierRepository,
  { code, tierId, ownId }: { code: string; tierId: string | null; ownId?: string },
) {
  const sameCode = await links.findByCode(code);
  if (sameCode && sameCode.id !== ownId) {
    throw new ConflictError(`El código "${code}" ya está en uso`, "code");
  }
  if (tierId && !(await tiers.findById(tierId))) {
    throw new ConflictError("El tier elegido no existe", "tierId");
  }
}

/** Platform + name identify a tier (unique in the database). */
export async function assertTierNameFree(
  tiers: TierRepository,
  { platform, name, ownId }: { platform: string; name: string; ownId?: string },
) {
  const all = await tiers.list();
  const taken = all.some(
    (t) => t.platform === platform && t.name.toLowerCase() === name.toLowerCase() && t.id !== ownId,
  );
  if (taken) throw new ConflictError(`Ya hay un tier "${name}" en esa plataforma`, "name");
}
