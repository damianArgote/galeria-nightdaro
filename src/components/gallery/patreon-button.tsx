import Link from "next/link";
import type { PublicArtwork } from "@/core/gallery/public-gallery";
import { cn } from "@/lib/utils";

/**
 * "Ver completa en Patreon": to the artwork's own post through /r/obra/{id}, which records the
 * click, or to /apoyar when it has none. A plain <a> for the post: a prefetch must not count.
 */
export function PatreonButton({
  artwork,
  className,
}: {
  artwork: Pick<PublicArtwork, "id" | "hasPatreonPost">;
  className?: string;
}) {
  if (artwork.hasPatreonPost) {
    return (
      <a href={`/r/obra/${artwork.id}`} rel="noopener" className={cn("gallery-cta", className)}>
        Ver completa en Patreon
      </a>
    );
  }
  return (
    <Link href="/apoyar" className={cn("gallery-cta", className)}>
      Ver completa en Patreon
    </Link>
  );
}
