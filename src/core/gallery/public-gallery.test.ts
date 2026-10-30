import { beforeEach, describe, expect, it } from "vitest";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import {
  FakeTierRepository,
  FakeTrackingLinkRepository,
} from "@/infra/links/fake-link-repositories";
import { FakeMediaAssetRepository } from "@/infra/media/fake-media-asset-repository";
import { MemoryStorage } from "@/infra/media/memory-storage";
import type { ArtworkRating } from "../artworks/artwork";
import { CreateArtwork } from "../artworks/create-artwork";
import { PublishArtwork } from "../artworks/publish-artwork";
import { CreateTier } from "../links/create-tier";
import { CreateTrackingLink } from "../links/create-tracking-link";
import { ListArtworkImages } from "../media/list-artwork-images";
import { ListArtworkVideos } from "../media/list-artwork-videos";
import type { ImageProcessor } from "../media/ports";
import { UploadArtworkImage } from "../media/upload-artwork-image";
import { GetPublicArtwork, ListPublicGallery, ResolvePublicMedia } from "./public-gallery";
import { ListPublicTiers } from "./public-tiers";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 1]);
const images: ImageProcessor = {
  detectFormat: async () => "jpeg",
  sanitize: async (data) => ({ data, format: "jpeg", width: 800, height: 1000 }),
  renderPublicVariants: async (source) => ({
    thumb: source,
    preview: source,
    placeholder: "data:blur",
  }),
};

let artworks: FakeArtworkRepository;
let media: FakeMediaAssetRepository;
let deps: ConstructorParameters<typeof ListPublicGallery>[0];

async function published(title: string, rating: ArtworkRating, withImage = true) {
  const artwork = await new CreateArtwork(artworks).execute({ title, kind: "finished", rating });
  if (withImage) {
    await new UploadArtworkImage({
      artworks,
      media,
      storage: new MemoryStorage(),
      images,
      keyPrefix: "nightdaro",
    }).execute({ artworkId: artwork.id, image: JPEG, charactersAreAdults: true });
  }
  return new PublishArtwork(artworks).execute({ id: artwork.id });
}

beforeEach(() => {
  artworks = new FakeArtworkRepository();
  media = new FakeMediaAssetRepository();
  const signer = { sign: (key: string) => `https://cdn/${key}?token=t` };
  deps = {
    artworks,
    images: new ListArtworkImages(media, signer),
    videos: new ListArtworkVideos(media, null),
  };
});

describe("ListPublicGallery", () => {
  it("shows only published sfw artworks without the age gate, and everything after it", async () => {
    const sfw = await published("Calabaza", "sfw");
    const suggestive = await published("Bruja", "suggestive");
    const explicit = await published("Súcubo", "explicit");
    await new CreateArtwork(artworks).execute({
      title: "Borrador",
      kind: "finished",
      rating: "sfw",
    });
    const gallery = new ListPublicGallery(deps);

    const anonymous = await gallery.execute({ kind: "finished", audience: "sfw" });
    const adult = await gallery.execute({ kind: "finished", audience: "adult" });

    expect(anonymous.map((a) => a.id)).toEqual([sfw.id]);
    expect(adult.map((a) => a.id)).toEqual([sfw.id, suggestive.id, explicit.id]);
  });

  it("returns image placeholders but never storage keys or signed URLs", async () => {
    await published("Calabaza", "sfw");
    await published("Sin imagen", "sfw", false);

    const items = await new ListPublicGallery(deps).execute({ kind: "finished", audience: "sfw" });

    expect(items.map((i) => i.image)).toEqual([
      { blurData: "data:blur", width: 800, height: 1000 },
      null,
    ]);
    expect(JSON.stringify(items)).not.toMatch(/nightdaro\/|token=|original/);
  });
});

describe("GetPublicArtwork", () => {
  it("finds an explicit artwork only after the age gate", async () => {
    const explicit = await published("Súcubo", "explicit");
    const get = new GetPublicArtwork(deps);

    expect(await get.execute({ slug: explicit.slug, audience: "sfw" })).toBeNull();
    expect(await get.execute({ slug: explicit.slug, audience: "adult" })).toMatchObject({
      id: explicit.id,
    });
    expect(await get.execute({ slug: "no-existe", audience: "adult" })).toBeNull();
  });
});

describe("ResolvePublicMedia", () => {
  it("signs a variant only for a published artwork the audience may see", async () => {
    const sfw = await published("Calabaza", "sfw");
    const explicit = await published("Súcubo", "explicit");
    const draft = await new CreateArtwork(artworks).execute({
      title: "Borrador",
      kind: "finished",
      rating: "sfw",
    });
    const resolve = new ResolvePublicMedia(deps);

    expect(await resolve.execute({ artworkId: sfw.id, variant: "thumb", audience: "sfw" })).toMatch(
      /thumb\.webp\?token=t$/,
    );
    expect(
      await resolve.execute({ artworkId: sfw.id, variant: "preview", audience: "sfw" }),
    ).toMatch(/preview\.webp\?token=t$/);
    expect(
      await resolve.execute({ artworkId: explicit.id, variant: "preview", audience: "sfw" }),
    ).toBeNull();
    expect(
      await resolve.execute({ artworkId: explicit.id, variant: "preview", audience: "adult" }),
    ).toMatch(/preview\.webp/);
    expect(
      await resolve.execute({ artworkId: draft.id, variant: "thumb", audience: "adult" }),
    ).toBeNull();
    expect(
      await resolve.execute({ artworkId: sfw.id, variant: "player", audience: "adult" }),
    ).toBeNull();
  });
});

describe("ListPublicTiers", () => {
  it("exposes each tier's /r/ code and never the platform URL", async () => {
    const tiers = new FakeTierRepository();
    const links = new FakeTrackingLinkRepository();
    const tinta = await new CreateTier(tiers).execute({
      platform: "patreon",
      name: "Tinta",
      priceCents: 700,
      url: "https://www.patreon.com/nightdaro",
    });
    await new CreateTier(tiers).execute({
      platform: "fansly",
      name: "VIP",
      priceCents: 1500,
      url: "https://fansly.com/nightdaro",
    });
    await new CreateTrackingLink(links, tiers).execute({
      label: "Tinta",
      code: "tinta",
      targetUrl: "https://www.patreon.com/nightdaro",
      tierId: tinta.id,
    });

    const result = await new ListPublicTiers(tiers, links).execute();

    expect(result.map((t) => [t.name, t.linkCode])).toEqual([
      ["Tinta", "tinta"],
      ["VIP", null],
    ]);
    expect(JSON.stringify(result)).not.toContain("https://");
  });
});
