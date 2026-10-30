import { cookies, headers } from "next/headers";
import { z } from "zod";
import { container } from "@/infra/container";
import { AGE_COOKIE, isCrawler } from "@/app/g/routing";

const paramsSchema = z.object({
  artworkId: z.uuid(),
  variant: z.enum(["thumb", "preview", "player"]),
});

/**
 * Stable media URL for cached gallery pages: signs a fresh, 1 hour URL on every request and
 * checks the age gate again, so suggestive and explicit files need the age_ok cookie too.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artworkId: string; variant: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return new Response("Not found", { status: 404 });

  const accepted = (await cookies()).get(AGE_COOKIE)?.value === "1";
  const crawler = isCrawler((await headers()).get("user-agent"));
  const url = await container.resolvePublicMedia.execute({
    ...parsed.data,
    audience: accepted && !crawler ? "adult" : "sfw",
  });
  if (!url) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      // Shorter than the signature's hour, and per visitor (it depends on the cookie).
      "Cache-Control": "private, max-age=600",
      Vary: "Cookie",
    },
  });
}
