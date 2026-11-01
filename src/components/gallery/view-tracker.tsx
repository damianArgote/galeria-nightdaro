"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "./track";

/** Counts a view of each page the visitor reaches (or of an artwork's detail page). */
export function ViewTracker({ artworkId }: { artworkId?: string }) {
  const pathname = usePathname();
  useEffect(() => {
    track({ type: "view", artworkId });
  }, [pathname, artworkId]);
  return null;
}
