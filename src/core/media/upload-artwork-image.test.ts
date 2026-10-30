import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import { FakeMediaAssetRepository } from "@/infra/media/fake-media-asset-repository";
import { CreateArtwork } from "../artworks/create-artwork";
import { InvalidInputError, NotFoundError } from "../shared/errors";
import { ListArtworkImages } from "./list-artwork-images";
import type { ImageProcessor, StoragePort, StorageZone } from "./ports";
import { MAX_IMAGE_BYTES, UploadArtworkImage } from "./upload-artwork-image";

class MemoryStorage implements StoragePort {
  readonly files = new Map<string, Uint8Array>();
  async put(zone: StorageZone, key: string, data: Uint8Array) {
    this.files.set(`${zone}:${key}`, data);
  }
  async delete(zone: StorageZone, key: string) {
    this.files.delete(`${zone}:${key}`);
  }
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 2]);

function fakeImages(
  overrides: Partial<ImageProcessor> = {},
): ImageProcessor & { blurred: boolean[] } {
  const blurred: boolean[] = [];
  return {
    blurred,
    detectFormat: async (data) => (data[0] === 0xff ? "jpeg" : data[0] === 0x89 ? "png" : null),
    sanitize: async (data, format) => ({ data, format, width: 3000, height: 2000 }),
    renderPublicVariants: async (source, { blur }) => {
      blurred.push(blur);
      return { thumb: source, preview: source, placeholder: "data:image/webp;base64,AA" };
    },
    ...overrides,
  };
}

let artworks: FakeArtworkRepository;
let media: FakeMediaAssetRepository;
let storage: MemoryStorage;
let images: ReturnType<typeof fakeImages>;
let ids: string[];

const upload = () =>
  new UploadArtworkImage({
    artworks,
    media,
    storage,
    images,
    keyPrefix: "nightdaro",
    newId: () => ids.shift()!,
  });

const artwork = (rating: "sfw" | "explicit" = "sfw") =>
  new CreateArtwork(artworks).execute({ title: "Obra", kind: "finished", rating });

beforeEach(() => {
  artworks = new FakeArtworkRepository();
  media = new FakeMediaAssetRepository();
  storage = new MemoryStorage();
  images = fakeImages();
  ids = ["asset-1", "asset-2"];
});

describe("UploadArtworkImage", () => {
  it("stores the original privately and the variants publicly under the nightdaro/ prefix", async () => {
    const { id } = await artwork();

    const result = await upload().execute({
      artworkId: id,
      image: JPEG,
      charactersAreAdults: true,
    });

    expect(result).toEqual({ id: "asset-1", width: 3000, height: 2000 });
    const base = `nightdaro/artworks/${id}/asset-1`;
    expect([...storage.files.keys()].sort()).toEqual([
      `originals:${base}/original.jpg`,
      `public:${base}/preview.webp`,
      `public:${base}/thumb.webp`,
    ]);
    expect(images.blurred).toEqual([false]);
  });

  it("requires confirming that the characters are adults", async () => {
    const { id } = await artwork();

    await expect(
      upload().execute({ artworkId: id, image: JPEG, charactersAreAdults: false as true }),
    ).rejects.toThrow(ZodError);
    expect(storage.files.size).toBe(0);
  });

  it("rejects files over 30 MB, empty files and unknown formats before storing anything", async () => {
    const { id } = await artwork();
    const tooBig = new Uint8Array(MAX_IMAGE_BYTES + 1);
    tooBig[0] = 0xff;

    for (const image of [tooBig, new Uint8Array(), new Uint8Array([1, 2, 3])]) {
      await expect(
        upload().execute({ artworkId: id, image, charactersAreAdults: true }),
      ).rejects.toThrow(InvalidInputError);
    }
    expect(storage.files.size).toBe(0);
  });

  it("fails for an unknown artwork", async () => {
    await expect(
      upload().execute({
        artworkId: "00000000-0000-4000-8000-000000000000",
        image: JPEG,
        charactersAreAdults: true,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("blurs explicit art without a censored version and uses the censored one when given", async () => {
    const explicit = await artwork("explicit");

    await upload().execute({ artworkId: explicit.id, image: JPEG, charactersAreAdults: true });
    await upload().execute({
      artworkId: explicit.id,
      image: JPEG,
      censored: PNG,
      charactersAreAdults: true,
    });

    expect(images.blurred).toEqual([true, false]);
    const [asset] = await media.listByArtworkIds([explicit.id]);
    expect(asset!.censoredKey).toBe(`nightdaro/artworks/${explicit.id}/asset-2/censored.png`);
    expect(storage.files.get(`public:nightdaro/artworks/${explicit.id}/asset-2/thumb.webp`)).toBe(
      PNG,
    );
  });

  it("ignores a censored version for non-explicit art", async () => {
    const { id } = await artwork("sfw");

    await upload().execute({
      artworkId: id,
      image: JPEG,
      censored: PNG,
      charactersAreAdults: true,
    });

    const [asset] = await media.listByArtworkIds([id]);
    expect(asset!.censoredKey).toBeNull();
  });

  it("replaces the previous image and deletes its files", async () => {
    const { id } = await artwork();

    await upload().execute({ artworkId: id, image: JPEG, charactersAreAdults: true });
    await upload().execute({ artworkId: id, image: PNG, charactersAreAdults: true });

    expect((await media.listByArtworkIds([id])).map((a) => a.id)).toEqual(["asset-2"]);
    expect([...storage.files.keys()].every((key) => key.includes("asset-2"))).toBe(true);
  });

  it("removes what it already stored when a later step fails", async () => {
    const { id } = await artwork();
    images = fakeImages({
      renderPublicVariants: async () => {
        throw new Error("sharp crashed");
      },
    });

    await expect(
      upload().execute({ artworkId: id, image: JPEG, charactersAreAdults: true }),
    ).rejects.toThrow("sharp crashed");
    expect(storage.files.size).toBe(0);
    expect(media.items.size).toBe(0);
  });
});

describe("ListArtworkImages", () => {
  it("returns signed public URLs and never a storage key of the original", async () => {
    const { id } = await artwork();
    await upload().execute({ artworkId: id, image: JPEG, charactersAreAdults: true });
    const now = new Date("2026-10-30T12:00:00.000Z");
    const signer = {
      sign: (key: string, expiresAt: Date) => `https://cdn/${key}?e=${expiresAt.getTime()}`,
    };

    const result = await new ListArtworkImages(media, signer, () => now).execute([id]);

    const image = result.get(id)!;
    expect(image.thumbUrl).toBe(
      `https://cdn/nightdaro/artworks/${id}/asset-1/thumb.webp?e=${now.getTime() + 3600_000}`,
    );
    expect(JSON.stringify(image)).not.toContain("original");
  });
});
