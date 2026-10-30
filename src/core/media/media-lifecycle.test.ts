import { beforeEach, describe, expect, it } from "vitest";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import { FakeMediaAssetRepository } from "@/infra/media/fake-media-asset-repository";
import { MemoryStorage } from "@/infra/media/memory-storage";
import { CreateArtwork } from "../artworks/create-artwork";
import { DeleteArtwork } from "../artworks/delete-artwork";
import { UpdateArtwork } from "../artworks/update-artwork";
import type { ImageProcessor } from "./ports";
import { RerenderArtworkImage } from "./rerender-artwork-image";
import { UploadArtworkImage } from "./upload-artwork-image";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 1]);
const CENSORED = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9]);

let artworks: FakeArtworkRepository;
let media: FakeMediaAssetRepository;
let storage: MemoryStorage;
let rendered: { source: Uint8Array; blur: boolean }[];
let ids: string[];
let failRender: boolean;

const images: ImageProcessor = {
  detectFormat: async (data) => (data[0] === 0xff ? "jpeg" : data[0] === 0x89 ? "png" : null),
  sanitize: async (data, format) => ({ data, format, width: 10, height: 10 }),
  renderPublicVariants: async (source, { blur }) => {
    if (failRender) throw new Error("render failed");
    rendered.push({ source, blur });
    return { thumb: source, preview: source, placeholder: `data:${blur}` };
  },
};

const newId = () => ids.shift() ?? crypto.randomUUID();
const rerender = () => new RerenderArtworkImage({ media, storage, images, newId });
const update = () => new UpdateArtwork(artworks, rerender());

async function artworkWithImage(rating: "sfw" | "explicit", censored?: Uint8Array) {
  const artwork = await new CreateArtwork(artworks).execute({
    title: "Obra",
    kind: "finished",
    rating,
  });
  await new UploadArtworkImage({
    artworks,
    media,
    storage,
    images,
    keyPrefix: "nightdaro",
    newId,
  }).execute({ artworkId: artwork.id, image: JPEG, censored, charactersAreAdults: true });
  rendered = [];
  return artwork;
}

const publicKeys = () => [...storage.files.keys()].filter((k) => k.startsWith("public:")).sort();

beforeEach(() => {
  artworks = new FakeArtworkRepository();
  media = new FakeMediaAssetRepository();
  storage = new MemoryStorage();
  rendered = [];
  ids = ["asset-1", "v2abcdefgh", "v3abcdefgh"];
  failRender = false;
});

describe("changing the rating of an artwork with an image", () => {
  it("blurs the public variants when it becomes explicit, under new keys", async () => {
    const artwork = await artworkWithImage("sfw");
    const before = publicKeys();

    await update().execute({ ...artwork, rating: "explicit" });

    expect(rendered).toEqual([{ source: JPEG, blur: true }]);
    const base = `public:nightdaro/artworks/${artwork.id}/asset-1`;
    expect(publicKeys()).toEqual([`${base}/preview-v2abcdef.webp`, `${base}/thumb-v2abcdef.webp`]);
    expect(publicKeys()).not.toEqual(expect.arrayContaining(before));
    const [asset] = await media.listByArtworkIds([artwork.id]);
    expect(asset).toMatchObject({
      blurData: "data:true",
      originalKey: expect.stringContaining("original.jpg"),
    });
    expect((await artworks.findById(artwork.id))?.rating).toBe("explicit");
  });

  it("uses the stored censored version when there is one", async () => {
    const artwork = await artworkWithImage("explicit", CENSORED);

    await update().execute({ ...artwork, rating: "suggestive" });
    await update().execute({ ...artwork, rating: "explicit" });

    expect(rendered).toEqual([
      { source: JPEG, blur: false },
      { source: CENSORED, blur: false },
    ]);
  });

  it("does not render again when the rating stays the same", async () => {
    const artwork = await artworkWithImage("sfw");

    await update().execute({ ...artwork, title: "Otro título" });

    expect(rendered).toEqual([]);
  });

  it("keeps the old rating and variants when rendering fails", async () => {
    const artwork = await artworkWithImage("sfw");
    const before = publicKeys();
    failRender = true;

    await expect(update().execute({ ...artwork, rating: "explicit" })).rejects.toThrow(
      "render failed",
    );

    expect((await artworks.findById(artwork.id))?.rating).toBe("sfw");
    expect(publicKeys()).toEqual(before);
  });

  it("changes the rating of an artwork without image", async () => {
    const artwork = await new CreateArtwork(artworks).execute({
      title: "Sin imagen",
      kind: "wip",
      rating: "sfw",
    });

    await update().execute({ ...artwork, rating: "explicit" });

    expect((await artworks.findById(artwork.id))?.rating).toBe("explicit");
  });
});

describe("deleting an artwork", () => {
  const remove = () => new DeleteArtwork(artworks, { media, storage });

  it("deletes its rows and every stored file", async () => {
    const artwork = await artworkWithImage("explicit", CENSORED);
    expect(storage.files.size).toBe(4);

    await remove().execute({ id: artwork.id });

    expect(await artworks.findById(artwork.id)).toBeNull();
    expect(storage.files.size).toBe(0);
  });

  it("still deletes the artwork when the storage fails", async () => {
    const artwork = await artworkWithImage("sfw");
    storage.failDeletes = true;

    await remove().execute({ id: artwork.id });

    expect(await artworks.findById(artwork.id)).toBeNull();
  });
});
