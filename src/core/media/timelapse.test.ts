import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import { FakeMediaAssetRepository } from "@/infra/media/fake-media-asset-repository";
import { FakeVideoPort } from "@/infra/media/fake-video-port";
import { MemoryStorage } from "@/infra/media/memory-storage";
import { DeleteArtwork } from "../artworks/delete-artwork";
import { ListArtworkVideos } from "./list-artwork-videos";
import { StartTimelapseUpload } from "./start-timelapse-upload";
import { SyncVideoStatus } from "./sync-video-status";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const input = {
  title: "Timelapse: Calabaza",
  rating: "sfw" as const,
  charactersAreAdults: true as const,
};

let artworks: FakeArtworkRepository;
let media: FakeMediaAssetRepository;
let video: FakeVideoPort;
let start: StartTimelapseUpload;

beforeEach(() => {
  artworks = new FakeArtworkRepository();
  media = new FakeMediaAssetRepository();
  video = new FakeVideoPort();
  start = new StartTimelapseUpload({ artworks, media, video, clock: () => NOW });
});

describe("StartTimelapseUpload", () => {
  it("creates a timelapse draft, a processing video and a 6 hour upload authorization", async () => {
    const { artworkId, upload } = await start.execute(input);

    expect(await artworks.findById(artworkId)).toMatchObject({
      kind: "timelapse",
      status: "draft",
      slug: "timelapse-calabaza",
    });
    expect(await media.listByArtworkIds([artworkId])).toEqual([
      expect.objectContaining({
        type: "video",
        streamVideoId: "video-1",
        status: "processing",
        originalKey: null,
      }),
    ]);
    expect(upload).toMatchObject({ videoId: "video-1", expires: NOW.getTime() / 1000 + 6 * 3600 });
  });

  it("requires the rating and the adults confirmation", async () => {
    await expect(start.execute({ ...input, charactersAreAdults: false as true })).rejects.toThrow(
      ZodError,
    );
    await expect(
      start.execute({ title: "x", charactersAreAdults: true } as typeof input),
    ).rejects.toThrow(ZodError);
    expect(await artworks.list()).toEqual([]);
  });

  it("removes the draft and the video when saving the asset fails", async () => {
    media.save = async () => {
      throw new Error("db down");
    };

    await expect(start.execute(input)).rejects.toThrow("db down");
    expect(await artworks.list()).toEqual([]);
    expect(video.deleted).toEqual(["video-1"]);
  });

  it("removes the draft when the video service fails", async () => {
    video.failCreate = true;

    await expect(start.execute(input)).rejects.toThrow("video service down");
    expect(await artworks.list()).toEqual([]);
  });
});

describe("SyncVideoStatus and ListArtworkVideos", () => {
  it("marks videos ready or failed and only signs ready ones", async () => {
    const a = await start.execute(input);
    const b = await start.execute({ ...input, title: "Otro" });
    const c = await start.execute({ ...input, title: "Tercero" });
    video.statuses.set("video-1", "ready");
    video.statuses.set("video-2", "failed");

    await new SyncVideoStatus(media, video).forArtworks([a.artworkId, b.artworkId, c.artworkId]);

    const videos = await new ListArtworkVideos(media, video, () => NOW).execute([
      a.artworkId,
      b.artworkId,
      c.artworkId,
    ]);
    expect(videos.get(a.artworkId)).toEqual({
      artworkId: a.artworkId,
      status: "ready",
      playerUrl: `https://player/video-1?expires=${NOW.getTime() / 1000 + 3600}`,
    });
    expect(videos.get(b.artworkId)).toMatchObject({ status: "failed", playerUrl: null });
    expect(videos.get(c.artworkId)).toMatchObject({ status: "processing", playerUrl: null });
  });

  it("keeps syncing the other videos when one status lookup fails", async () => {
    const a = await start.execute(input);
    const b = await start.execute({ ...input, title: "Otro" });
    video.statuses.set("video-2", "ready");
    const getStatus = video.getStatus.bind(video);
    video.getStatus = async (id) => {
      if (id === "video-1") throw new Error("api down");
      return getStatus(id);
    };

    await new SyncVideoStatus(media, video).forArtworks([a.artworkId, b.artworkId]);

    const assets = await media.listByArtworkIds([a.artworkId, b.artworkId]);
    expect(Object.fromEntries(assets.map((x) => [x.streamVideoId, x.status]))).toEqual({
      "video-1": "processing",
      "video-2": "ready",
    });
  });

  it("syncs one video from the webhook id and ignores unknown ids", async () => {
    const a = await start.execute(input);
    video.statuses.set("video-1", "ready");
    const sync = new SyncVideoStatus(media, video);

    await sync.forVideo("unknown");
    await sync.forVideo("video-1");

    const [asset] = await media.listByArtworkIds([a.artworkId]);
    expect(asset!.status).toBe("ready");
  });

  it("never signs a player URL without a configured video service", async () => {
    const a = await start.execute(input);
    video.statuses.set("video-1", "ready");
    await new SyncVideoStatus(media, video).forArtworks([a.artworkId]);

    const videos = await new ListArtworkVideos(media, null).execute([a.artworkId]);

    expect(videos.get(a.artworkId)).toMatchObject({ status: "ready", playerUrl: null });
  });
});

describe("deleting a timelapse", () => {
  it("deletes the video from the video service", async () => {
    const { artworkId } = await start.execute(input);

    await new DeleteArtwork(artworks, { media, storage: new MemoryStorage(), video }).execute({
      id: artworkId,
    });

    expect(video.deleted).toEqual(["video-1"]);
  });
});
