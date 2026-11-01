import { beforeEach, describe, expect, it } from "vitest";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import { FakeMediaAssetRepository } from "@/infra/media/fake-media-asset-repository";
import { FakeVideoPort } from "@/infra/media/fake-video-port";
import { MemoryStorage } from "@/infra/media/memory-storage";
import { CreateArtwork } from "../artworks/create-artwork";
import type { MediaAsset } from "./media-asset";
import type { ImageProcessor } from "./ports";
import { EnsureTimelapseCovers } from "./timelapse-covers";
import { UploadArtworkImage } from "./upload-artwork-image";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 1]);
const images: ImageProcessor = {
  detectFormat: async (data) => (data[0] === 0xff ? "jpeg" : null),
  sanitize: async (data, format) => ({ data, format, width: 1280, height: 720 }),
  renderPublicVariants: async (source) => ({
    thumb: source,
    preview: source,
    placeholder: "data:,",
  }),
};

let artworks: FakeArtworkRepository;
let media: FakeMediaAssetRepository;
let video: FakeVideoPort;
let ensure: EnsureTimelapseCovers;

const videoAsset = (
  artworkId: string,
  videoId: string,
  status: MediaAsset["status"],
): MediaAsset => ({
  id: `asset-${videoId}`,
  artworkId,
  type: "video",
  originalKey: null,
  previewKey: null,
  thumbKey: null,
  censoredKey: null,
  blurData: null,
  width: null,
  height: null,
  streamVideoId: videoId,
  status,
  renderedRating: null,
});

async function timelapse(title: string) {
  return new CreateArtwork(artworks).execute({ title, kind: "timelapse", rating: "sfw" });
}

beforeEach(() => {
  artworks = new FakeArtworkRepository();
  media = new FakeMediaAssetRepository();
  video = new FakeVideoPort();
  const upload = new UploadArtworkImage({
    artworks,
    media,
    storage: new MemoryStorage(),
    images,
    keyPrefix: "nightdaro",
  });
  ensure = new EnsureTimelapseCovers(media, video, upload);
});

describe("EnsureTimelapseCovers", () => {
  it("turns the video service thumbnail into the cover of a ready timelapse without one", async () => {
    const { id } = await timelapse("Calabaza");
    await media.save(videoAsset(id, "v1", "ready"));
    video.thumbnails.set("v1", JPEG);

    await ensure.forArtworks([id]);

    const assets = await media.listByArtworkIds([id]);
    expect(assets.map((a) => a.type).sort()).toEqual(["image", "video"]);
  });

  it("keeps a cover that already exists, and waits while the video is processing", async () => {
    const withCover = await timelapse("Con portada");
    await media.save(videoAsset(withCover.id, "v1", "ready"));
    await media.save({
      ...videoAsset(withCover.id, "x", "ready"),
      id: "img",
      type: "image",
      streamVideoId: null,
    });
    const processing = await timelapse("Procesando");
    await media.save(videoAsset(processing.id, "v2", "processing"));
    video.thumbnails.set("v1", JPEG);
    video.thumbnails.set("v2", JPEG);

    await ensure.forArtworks([withCover.id, processing.id]);

    expect(
      (await media.listByArtworkIds([withCover.id])).filter((a) => a.type === "image"),
    ).toHaveLength(1);
    expect((await media.listByArtworkIds([processing.id])).some((a) => a.type === "image")).toBe(
      false,
    );
  });

  it("skips a video without thumbnail and does not stop at a failing one", async () => {
    const missing = await timelapse("Sin miniatura");
    await media.save(videoAsset(missing.id, "v1", "ready"));
    const broken = await timelapse("Rota");
    await media.save(videoAsset(broken.id, "v2", "ready"));
    video.thumbnails.set("v2", new Uint8Array([1, 2, 3])); // not an image
    const fine = await timelapse("Bien");
    await media.save(videoAsset(fine.id, "v3", "ready"));
    video.thumbnails.set("v3", JPEG);

    await ensure.forArtworks([missing.id, broken.id, fine.id]);

    const covers = (await media.listByArtworkIds([missing.id, broken.id, fine.id])).filter(
      (a) => a.type === "image",
    );
    expect(covers.map((a) => a.artworkId)).toEqual([fine.id]);
  });
});
