import { beforeEach, describe, expect, it } from "vitest";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import { FakePatreonConnectionRepository, FakePatreonPort } from "@/infra/patreon/fake-patreon";
import { CreateArtwork } from "../artworks/create-artwork";
import { ConflictError } from "../shared/errors";
import { PatreonAccess } from "./connect";
import type { PatreonPost } from "./patreon";
import { LinkArtworkToPatreonPost, PreviewPatreonSync, sameTitle } from "./post-sync";

const NOW = new Date("2026-11-02T12:00:00Z");
const post = (id: string, title: string, day: number): PatreonPost => ({
  id,
  title,
  url: `https://www.patreon.com/posts/${id}`,
  publishedAt: new Date(Date.UTC(2026, 9, day)),
  content: null,
});

let patreon: FakePatreonPort;
let artworks: FakeArtworkRepository;
let access: PatreonAccess;
let connections: FakePatreonConnectionRepository;

beforeEach(async () => {
  patreon = new FakePatreonPort();
  artworks = new FakeArtworkRepository();
  connections = new FakePatreonConnectionRepository();
  await connections.save({
    campaignId: "camp-1",
    campaignUrl: "https://www.patreon.com/cw/Ndaro",
    tokens: {
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: new Date(NOW.getTime() + 3_600_000),
    },
    webhook: null,
    connectedAt: NOW,
  });
  access = new PatreonAccess(patreon, connections, () => NOW);
});

const create = (title: string, extra: Partial<{ patreonPostUrl: string }> = {}, postId?: string) =>
  new CreateArtwork(artworks).execute(
    { title, kind: "finished", rating: "sfw", ...extra },
    postId ? { patreonPostId: postId } : {},
  );

describe("sameTitle", () => {
  it("ignores case, accents, punctuation and decoration", () => {
    expect(sameTitle("♜Support♜", "support")).toBe(true);
    expect(sameTitle("Súcubo de Halloween!", "sucubo   de halloween")).toBe(true);
    expect(sameTitle("Súcubo", "Súcubo de Halloween")).toBe(false);
    expect(sameTitle("", "")).toBe(false);
  });
});

describe("PreviewPatreonSync", () => {
  it("groups Patreon's posts into linked, suggested by title and missing, newest first", async () => {
    for (const p of [
      post("p1", "Kitsune", 1),
      post("p2", "Súcubo de Halloween", 2),
      post("p3", "Bruja nueva", 3),
      post("p4", "Por link", 4),
    ]) {
      patreon.posts.set(p.id, p);
    }
    const kitsune = await create("Kitsune", {}, "p1");
    const sucubo = await create("sucubo de halloween");
    const byUrl = await create("Otro nombre", {
      patreonPostUrl: "https://www.patreon.com/posts/p4",
    });
    const free = await create("Sin post");

    const preview = await new PreviewPatreonSync(patreon, access, artworks, connections).execute();

    expect(preview.linked.map((l) => [l.post.id, l.artwork.id])).toEqual([
      ["p4", byUrl.id],
      ["p1", kitsune.id],
    ]);
    expect(preview.suggested.map((s) => [s.post.id, s.artwork.id])).toEqual([["p2", sucubo.id]]);
    expect(preview.missing.map((p) => p.id)).toEqual(["p3"]);
    // Artworks still free to link by hand: not linked to any post.
    expect(preview.available.map((a) => a.id).sort()).toEqual([free.id, sucubo.id].sort());
  });
});

describe("LinkArtworkToPatreonPost", () => {
  beforeEach(() => {
    patreon.posts.set("p2", post("p2", "Súcubo de Halloween", 2));
  });

  it("links an artwork to a post, storing the post's link", async () => {
    const artwork = await create("Súcubo");
    await new LinkArtworkToPatreonPost(patreon, access, artworks).execute({
      artworkId: artwork.id,
      postId: "p2",
    });
    expect(await artworks.findById(artwork.id)).toMatchObject({
      patreonPostId: "p2",
      patreonPostUrl: "https://www.patreon.com/posts/p2",
    });
  });

  it("never links one post to two artworks, nor an artwork to a second post", async () => {
    const link = new LinkArtworkToPatreonPost(patreon, access, artworks);
    const first = await create("Uno", {}, "p2");
    const second = await create("Dos");
    await expect(link.execute({ artworkId: second.id, postId: "p2" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    patreon.posts.set("p9", post("p9", "Otro", 9));
    await expect(link.execute({ artworkId: first.id, postId: "p9" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
