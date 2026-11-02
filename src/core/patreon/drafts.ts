import { CreateArtwork } from "../artworks/create-artwork";
import { isPatreonUrl } from "../artworks/artwork-schemas";
import type { ArtworkRepository } from "../artworks/artwork-repository";
import type { UploadArtworkImage } from "../media/upload-artwork-image";
import type { PatreonAccess } from "./connect";
import { firstPostImage } from "./patreon";
import type { PatreonPort } from "./ports";

const dayMonthYear = (date: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);

/**
 * posts:publish → a draft in the gallery, ready for Daro to review: the post's title and link,
 * rating explicit (the most restrictive) until she changes it, and the post's first image when
 * Patreon hosts it — rendered blurred, as any explicit artwork. Nothing is published by itself.
 * One draft per post: retries and repeated announcements find the existing one.
 */
export class CreateDraftFromPatreonPost {
  constructor(
    private readonly deps: {
      patreon: PatreonPort;
      access: PatreonAccess;
      artworks: ArtworkRepository;
      images: UploadArtworkImage;
    },
  ) {}

  async execute({ postId }: { postId: string }): Promise<void> {
    const { patreon, access, artworks, images } = this.deps;
    if (await artworks.findByPatreonPostId(postId)) return;

    const post = await patreon.getPost(await access.token(), postId);
    if (!post) return;

    const title =
      post.title?.trim().slice(0, 120) ||
      `Post de Patreon del ${dayMonthYear(post.publishedAt ?? new Date())}`;
    const draft = await new CreateArtwork(artworks).execute(
      {
        title,
        kind: "finished",
        rating: "explicit",
        patreonPostUrl: post.url && isPatreonUrl(post.url) ? post.url : null,
      },
      { patreonPostId: post.id },
    );

    const imageUrl = firstPostImage(post.content);
    if (!imageUrl) return;
    try {
      const image = await patreon.downloadPostImage(imageUrl);
      // Confirmed by Daro when she published it on Patreon; she reviews the draft anyway.
      if (image) {
        await images.execute({ artworkId: draft.id, image, charactersAreAdults: true });
      }
    } catch (error) {
      // The draft stays; Daro adds the image by hand.
      console.error("Could not attach the Patreon post image", postId, error);
    }
  }
}
