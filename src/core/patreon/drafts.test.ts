import { beforeEach, describe, expect, it } from "vitest";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import { FakeMediaAssetRepository } from "@/infra/media/fake-media-asset-repository";
import { MemoryStorage } from "@/infra/media/memory-storage";
import { FakePatreonConnectionRepository, FakePatreonPort } from "@/infra/patreon/fake-patreon";
import { UploadArtworkImage } from "../media/upload-artwork-image";
import type { ImageProcessor } from "../media/ports";
import { PatreonAccess } from "./connect";
import { CreateDraftFromPatreonPost } from "./drafts";
import { firstPostImage } from "./patreon";

const NOW = new Date("2026-11-02T12:00:00Z");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 1]);
const blurred: boolean[] = [];
const images: ImageProcessor = {
  detectFormat: async (data) => (data[0] === 0xff ? "jpeg" : null),
  sanitize: async (data, format) => ({ data, format, width: 1200, height: 1500 }),
  renderPublicVariants: async (source, { blur }) => {
    blurred.push(blur);
    return { thumb: source, preview: source, placeholder: "data:," };
  },
};

let patreon: FakePatreonPort;
let artworks: FakeArtworkRepository;
let media: FakeMediaAssetRepository;
let drafts: CreateDraftFromPatreonPost;

beforeEach(async () => {
  patreon = new FakePatreonPort();
  artworks = new FakeArtworkRepository();
  media = new FakeMediaAssetRepository();
  blurred.length = 0;
  const connections = new FakePatreonConnectionRepository();
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
  drafts = new CreateDraftFromPatreonPost({
    patreon,
    access: new PatreonAccess(patreon, connections, () => NOW),
    artworks,
    images: new UploadArtworkImage({
      artworks,
      media,
      storage: new MemoryStorage(),
      images,
      keyPrefix: "nightdaro",
    }),
  });
  patreon.posts.set("p-1", {
    id: "p-1",
    title: "Súcubo de Halloween",
    url: "https://www.patreon.com/posts/sucubo-de-halloween-123",
    publishedAt: NOW,
    content:
      '<p>Nueva!</p><img src="https://c10.patreonusercontent.com/4/x/sucubo.jpg?token=a&amp;b=1">',
  });
  patreon.images.set("https://c10.patreonusercontent.com/4/x/sucubo.jpg?token=a&b=1", JPEG);
});

describe("CreateDraftFromPatreonPost", () => {
  it("creates an explicit draft with the post's title and link, and its image blurred until reviewed", async () => {
    await drafts.execute({ postId: "p-1" });

    const [draft] = await artworks.list({});
    expect(draft).toMatchObject({
      title: "Súcubo de Halloween",
      status: "draft",
      kind: "finished",
      rating: "explicit",
      patreonPostUrl: "https://www.patreon.com/posts/sucubo-de-halloween-123",
      patreonPostId: "p-1",
    });
    expect((await media.listByArtworkIds([draft!.id])).map((a) => a.type)).toEqual(["image"]);
    expect(blurred).toEqual([true]);
  });

  it("creates one draft per post, however many times Patreon announces it", async () => {
    await drafts.execute({ postId: "p-1" });
    await drafts.execute({ postId: "p-1" });
    expect(await artworks.list({})).toHaveLength(1);
  });

  it("still creates the draft when the post has no Patreon image, or it cannot be downloaded", async () => {
    patreon.posts.set("p-2", {
      ...patreon.posts.get("p-1")!,
      id: "p-2",
      title: null,
      content: "<p>texto</p>",
    });
    patreon.posts.set("p-3", {
      ...patreon.posts.get("p-1")!,
      id: "p-3",
      content: '<img src="https://c10.patreonusercontent.com/missing.jpg">',
    });

    await drafts.execute({ postId: "p-2" });
    await drafts.execute({ postId: "p-3" });

    const titles = (await artworks.list({})).map((a) => a.title).sort();
    expect(titles).toEqual(["Post de Patreon del 02/11/2026", "Súcubo de Halloween"]);
    expect(await media.listByArtworkIds((await artworks.list({})).map((a) => a.id))).toEqual([]);
  });

  it("does nothing for a post Patreon no longer has, and drops a link that is not on patreon.com", async () => {
    await drafts.execute({ postId: "gone" });
    expect(await artworks.list({})).toEqual([]);

    patreon.posts.set("p-4", {
      ...patreon.posts.get("p-1")!,
      id: "p-4",
      url: "https://evil.example/x",
    });
    await drafts.execute({ postId: "p-4" });
    expect((await artworks.list({}))[0]?.patreonPostUrl).toBeNull();
  });
});

describe("firstPostImage", () => {
  it("only takes images hosted by Patreon", () => {
    expect(
      firstPostImage(
        '<img src="https://evil.example/a.jpg"><img src="https://c8.patreonusercontent.com/b.png">',
      ),
    ).toBe("https://c8.patreonusercontent.com/b.png");
    expect(firstPostImage('<img src="http://c8.patreonusercontent.com/b.png">')).toBeNull();
    expect(
      firstPostImage('<img src="https://patreonusercontent.com.evil.example/b.png">'),
    ).toBeNull();
    expect(firstPostImage(null)).toBeNull();
  });
});
