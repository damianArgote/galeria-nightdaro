import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateArtwork } from "@/core/artworks/create-artwork";
import { UploadArtworkImage } from "@/core/media/upload-artwork-image";
import { InvalidInputError } from "@/core/shared/errors";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import {
  EXE_RENAMED_AS_JPG,
  jpegWithExif,
  pngImage,
  SVG_IMAGE,
} from "../../../tests/helpers/images";
import { FakeMediaAssetRepository } from "./fake-media-asset-repository";
import { SharpImageProcessor } from "./sharp-image-processor";
import { LocalStorageAdapter } from "./storage-adapters";

/** Real sharp + file-type + files on disk; only the repositories are in memory. */
describe("image upload pipeline", () => {
  let root: string;
  let storage: LocalStorageAdapter;
  let artworks: FakeArtworkRepository;
  let media: FakeMediaAssetRepository;
  let upload: UploadArtworkImage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "nightdaro-storage-"));
    storage = new LocalStorageAdapter(root);
    artworks = new FakeArtworkRepository();
    media = new FakeMediaAssetRepository();
    upload = new UploadArtworkImage({
      artworks,
      media,
      storage,
      images: new SharpImageProcessor(),
      keyPrefix: "nightdaro",
    });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const artwork = (rating: "sfw" | "suggestive" | "explicit" = "sfw") =>
    new CreateArtwork(artworks).execute({ title: "Prueba", kind: "finished", rating });

  const files = async (zone: string) =>
    (await readdir(join(root, zone), { recursive: true }).catch(() => [])).filter((f) =>
      f.includes("."),
    );

  it.each([
    ["an SVG", SVG_IMAGE],
    ["an .exe renamed to .jpg", EXE_RENAMED_AS_JPG],
  ])("rejects %s and writes nothing", async (_name, bytes) => {
    const { id } = await artwork();

    await expect(
      upload.execute({ artworkId: id, image: bytes, charactersAreAdults: true }),
    ).rejects.toThrow(InvalidInputError);
    expect(await files("originals")).toEqual([]);
    expect(await files("public")).toEqual([]);
    expect(media.items.size).toBe(0);
  });

  it("stores the original without EXIF and renders the public variants", async () => {
    const { id } = await artwork();
    const image = await jpegWithExif();
    expect(await sharp(image).metadata()).toMatchObject({
      orientation: 6,
      exif: expect.anything(),
    });

    await upload.execute({ artworkId: id, image, charactersAreAdults: true });

    const [asset] = await media.listByArtworkIds([id]);
    expect(asset).toMatchObject({ status: "ready", type: "image", width: 2000, height: 3000 });
    expect(asset!.originalKey).toMatch(
      new RegExp(`^nightdaro/artworks/${id}/[^/]+/original\\.jpg$`),
    );

    const original = await readFile(join(root, "originals", asset!.originalKey!));
    const originalMeta = await sharp(original).metadata();
    expect(originalMeta.exif).toBeUndefined();
    expect(original.includes("SecretCam")).toBe(false);
    expect([originalMeta.width, originalMeta.height]).toEqual([2000, 3000]);

    const thumb = await sharp(await readFile(join(root, "public", asset!.thumbKey!))).metadata();
    const preview = await sharp(
      await readFile(join(root, "public", asset!.previewKey!)),
    ).metadata();
    expect(thumb).toMatchObject({ format: "webp" });
    expect(Math.max(thumb.width!, thumb.height!)).toBe(400);
    expect(preview).toMatchObject({ format: "webp" });
    expect(Math.max(preview.width!, preview.height!)).toBe(1600);
    expect(preview.exif).toBeUndefined();
    expect(asset!.blurData).toMatch(/^data:image\/webp;base64,/);

    expect(await files("public")).toHaveLength(2);
    expect((await files("originals")).every((f) => f.endsWith("original.jpg"))).toBe(true);
  });

  it("never enlarges a small image and watermarks the preview", async () => {
    const { id } = await artwork();
    const plain = await pngImage(800, 600);

    await upload.execute({ artworkId: id, image: plain, charactersAreAdults: true });

    const [asset] = await media.listByArtworkIds([id]);
    const preview = await readFile(join(root, "public", asset!.previewKey!));
    expect(await sharp(preview).metadata()).toMatchObject({ width: 800, height: 600 });
    const stats = await sharp(preview).stats();
    // A flat colour has no variation; the tiled watermark adds some.
    expect(stats.channels[0]!.stdev).toBeGreaterThan(2);
  });

  it("blurs explicit art when there is no censored version", async () => {
    const { id } = await artwork("explicit");

    await upload.execute({
      artworkId: id,
      image: await jpegWithExif(1200, 800),
      charactersAreAdults: true,
    });

    const [asset] = await media.listByArtworkIds([id]);
    const thumb = await sharp(await readFile(join(root, "public", asset!.thumbKey!))).stats();
    // The source is gaussian noise (stdev 60); the strong blur flattens it.
    expect(thumb.channels[0]!.stdev).toBeLessThan(10);
    expect(asset!.censoredKey).toBeNull();
  });

  it("uses the censored upload as the public image of explicit art", async () => {
    const { id } = await artwork("explicit");

    await upload.execute({
      artworkId: id,
      image: await jpegWithExif(1200, 800),
      censored: await pngImage(800, 600, "#22e4ff"),
      charactersAreAdults: true,
    });

    const [asset] = await media.listByArtworkIds([id]);
    expect(asset!.censoredKey).toMatch(/\/censored\.png$/);
    const thumb = await sharp(await readFile(join(root, "public", asset!.thumbKey!))).stats();
    expect(thumb.dominant).toMatchObject({ r: expect.any(Number) });
    expect(thumb.channels[2]!.mean).toBeGreaterThan(200);
  });
});
