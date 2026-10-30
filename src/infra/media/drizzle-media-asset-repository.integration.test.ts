import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CreateArtwork } from "@/core/artworks/create-artwork";
import type { MediaAsset } from "@/core/media/media-asset";
import { DrizzleArtworkRepository } from "@/infra/artworks/drizzle-artwork-repository";
import { createTestDb, databaseUrl } from "../../../tests/helpers/test-db";
import { DrizzleMediaAssetRepository } from "./drizzle-media-asset-repository";

describe.skipIf(!databaseUrl)("DrizzleMediaAssetRepository against Postgres", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;

  beforeAll(async () => {
    testDb = await createTestDb("media");
    await testDb.reset();
  });

  afterAll(async () => {
    await testDb?.close();
  });

  it("stores the rendered rating and keeps the creation time on update", async () => {
    const artwork = await new CreateArtwork(new DrizzleArtworkRepository(testDb.db)).execute({
      title: "Obra",
      kind: "finished",
      rating: "explicit",
    });
    const repo = new DrizzleMediaAssetRepository(testDb.db);
    const asset: MediaAsset = {
      id: crypto.randomUUID(),
      artworkId: artwork.id,
      type: "video",
      originalKey: null,
      previewKey: null,
      thumbKey: null,
      censoredKey: null,
      blurData: null,
      width: null,
      height: null,
      streamVideoId: "stream-1",
      status: "processing",
      renderedRating: "explicit",
    };

    await repo.save(asset);
    const [saved] = await repo.listByArtworkIds([artwork.id]);
    expect(saved).toMatchObject({ renderedRating: "explicit", createdAt: expect.any(Date) });

    await repo.save({ ...saved!, status: "ready", createdAt: new Date(0) });
    const updated = await repo.findByStreamVideoId("stream-1");
    expect(updated).toMatchObject({ status: "ready" });
    expect(updated!.createdAt).toEqual(saved!.createdAt);
  });
});
