import { z } from "zod";
import type { Artwork } from "../artworks/artwork";
import type { ArtworkRepository } from "../artworks/artwork-repository";
import { isPatreonUrl } from "../artworks/artwork-schemas";
import { ConflictError, NotFoundError } from "../shared/errors";
import { PatreonNotConnectedError, type PatreonAccess } from "./connect";
import type { PatreonPost } from "./patreon";
import type { PatreonConnectionRepository, PatreonPort } from "./ports";

/** Lowercase letters and digits only: accents, punctuation and decorations do not count. */
function titleKey(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sameTitle(a: string, b: string): boolean {
  const key = titleKey(a);
  return key !== "" && key === titleKey(b);
}

export type ArtworkRef = Pick<Artwork, "id" | "title" | "status" | "kind">;
const ref = ({ id, title, status, kind }: Artwork): ArtworkRef => ({ id, title, status, kind });

export interface PatreonSyncPreview {
  /** Already tied to an artwork (by post id, or by its link). */
  linked: { post: PatreonPost; artwork: ArtworkRef }[];
  /** Not tied yet, but an artwork without a post has the same title. */
  suggested: { post: PatreonPost; artwork: ArtworkRef }[];
  /** No artwork for them: a draft can be created. */
  missing: PatreonPost[];
  /** Artworks not tied to any post, to pick one by hand. */
  available: ArtworkRef[];
}

/** Read only: what a sync with the posts already on Patreon would do. Nothing is changed. */
export class PreviewPatreonSync {
  constructor(
    private readonly patreon: PatreonPort,
    private readonly access: PatreonAccess,
    private readonly artworks: ArtworkRepository,
    private readonly connections: PatreonConnectionRepository,
  ) {}

  async execute(): Promise<PatreonSyncPreview> {
    const token = await this.access.token();
    const campaignId = await this.campaignId();
    const [posts, artworks] = await Promise.all([
      this.patreon.listPosts(token, campaignId),
      this.artworks.list({}),
    ]);
    posts.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));

    const tied = (artwork: Artwork) => !!artwork.patreonPostId || !!artwork.patreonPostUrl;
    const taken = new Set<string>();
    const preview: PatreonSyncPreview = { linked: [], suggested: [], missing: [], available: [] };

    for (const post of posts) {
      const owner = artworks.find(
        (a) => a.patreonPostId === post.id || (!!post.url && a.patreonPostUrl === post.url),
      );
      if (owner) {
        preview.linked.push({ post, artwork: ref(owner) });
        taken.add(owner.id);
        continue;
      }
      const match = artworks.find(
        (a) => !tied(a) && !taken.has(a.id) && !!post.title && sameTitle(a.title, post.title),
      );
      if (match) {
        preview.suggested.push({ post, artwork: ref(match) });
        taken.add(match.id);
      } else {
        preview.missing.push(post);
      }
    }
    preview.available = artworks.filter((a) => !tied(a)).map(ref);
    return preview;
  }

  private async campaignId(): Promise<string> {
    const connection = await this.connections.get();
    if (!connection) throw new PatreonNotConnectedError();
    return connection.campaignId;
  }
}

export const linkArtworkToPostSchema = z.object({
  artworkId: z.uuid(),
  postId: z.string().regex(/^[\w-]{1,64}$/),
});

/** Ties an existing artwork to its Patreon post: one post per artwork and vice versa. */
export class LinkArtworkToPatreonPost {
  constructor(
    private readonly patreon: PatreonPort,
    private readonly access: PatreonAccess,
    private readonly artworks: ArtworkRepository,
  ) {}

  async execute(input: z.input<typeof linkArtworkToPostSchema>): Promise<void> {
    const { artworkId, postId } = linkArtworkToPostSchema.parse(input);
    const artwork = await this.artworks.findById(artworkId);
    if (!artwork) throw new NotFoundError("Artwork", artworkId);
    const owner = await this.artworks.findByPatreonPostId(postId);
    if (owner && owner.id !== artworkId) {
      throw new ConflictError(`Ese post ya está vinculado a «${owner.title}».`);
    }
    if (artwork.patreonPostId && artwork.patreonPostId !== postId) {
      throw new ConflictError(`«${artwork.title}» ya está vinculada a otro post.`);
    }
    const post = await this.patreon.getPost(await this.access.token(), postId);
    if (!post) throw new NotFoundError("Patreon post", postId);
    await this.artworks.save({
      ...artwork,
      patreonPostId: post.id,
      patreonPostUrl: post.url && isPatreonUrl(post.url) ? post.url : artwork.patreonPostUrl,
    });
  }
}
