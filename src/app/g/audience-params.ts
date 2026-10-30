import { notFound } from "next/navigation";
import { isAudience, type Audience } from "@/core/gallery/audience";

/** Pages are generated on the first request and cached (ISR), so the build needs no database. */
export const REVALIDATE_SECONDS = 300;

export async function audienceFrom(params: Promise<{ audience: string }>): Promise<Audience> {
  const { audience } = await params;
  if (!isAudience(audience)) notFound();
  return audience;
}
