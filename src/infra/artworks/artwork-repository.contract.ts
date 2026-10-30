import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Artwork } from "@/core/artworks/artwork";
import type { ArtworkRepository } from "@/core/artworks/artwork-repository";

export function buildArtwork(overrides: Partial<Artwork> = {}): Artwork {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    slug: `artwork-${id.slice(0, 8)}`,
    title: "Neon night",
    description: null,
    kind: "finished",
    rating: "sfw",
    status: "draft",
    position: 0,
    tags: [],
    publishedAt: null,
    ...overrides,
  };
}

/** Behavior every ArtworkRepository implementation must share. */
export function describeArtworkRepositoryContract(
  name: string,
  setup: () => Promise<ArtworkRepository>,
) {
  describe(`${name} (ArtworkRepository contract)`, () => {
    let repository: ArtworkRepository;

    beforeEach(async () => {
      repository = await setup();
    });

    it("saves an artwork and finds it by id and by slug", async () => {
      const artwork = buildArtwork({
        description: "Ink and neon",
        rating: "suggestive",
        tags: ["manga", "neon"],
        publishedAt: new Date("2026-10-01T12:00:00.000Z"),
      });

      await repository.save(artwork);

      expect(await repository.findById(artwork.id)).toEqual(artwork);
      expect(await repository.findBySlug(artwork.slug)).toEqual(artwork);
    });

    it("returns null for unknown ids and slugs", async () => {
      expect(await repository.findById(randomUUID())).toBeNull();
      expect(await repository.findBySlug("missing")).toBeNull();
    });

    it("replaces an existing artwork when saved again with the same id", async () => {
      const artwork = buildArtwork();
      await repository.save(artwork);

      const updated = { ...artwork, title: "Renamed", status: "published" as const };
      await repository.save(updated);

      expect(await repository.findById(artwork.id)).toEqual(updated);
      expect(await repository.list()).toHaveLength(1);
    });

    it("rejects a second artwork with a slug already in use", async () => {
      await repository.save(buildArtwork({ slug: "taken" }));

      await expect(repository.save(buildArtwork({ slug: "taken" }))).rejects.toThrow();
    });

    it("lists by position and filters by kind and status", async () => {
      const third = buildArtwork({ position: 2, status: "published" });
      const first = buildArtwork({ position: 0, status: "published" });
      const wip = buildArtwork({ position: 1, kind: "wip", status: "published" });
      const draft = buildArtwork({ position: 3 });
      for (const artwork of [third, first, wip, draft]) await repository.save(artwork);

      expect((await repository.list()).map((a) => a.id)).toEqual([
        first.id,
        wip.id,
        third.id,
        draft.id,
      ]);
      expect(
        (await repository.list({ kind: "finished", status: "published" })).map((a) => a.id),
      ).toEqual([first.id, third.id]);
    });

    it("filters by ratings and slug", async () => {
      const sfw = buildArtwork({ rating: "sfw", slug: "a" });
      const explicit = buildArtwork({ rating: "explicit", slug: "b" });
      for (const artwork of [sfw, explicit]) await repository.save(artwork);

      expect((await repository.list({ ratings: ["sfw"] })).map((a) => a.id)).toEqual([sfw.id]);
      expect((await repository.list({ ratings: [] })).map((a) => a.id)).toEqual([]);
      expect((await repository.list({ slug: "b" })).map((a) => a.id)).toEqual([explicit.id]);
    });

    it("updates positions so the list follows the new order", async () => {
      const a = buildArtwork({ position: 0 });
      const b = buildArtwork({ position: 1 });
      const c = buildArtwork({ position: 2 });
      for (const artwork of [a, b, c]) await repository.save(artwork);

      await repository.updatePositions([
        { id: c.id, position: 0 },
        { id: a.id, position: 1 },
        { id: b.id, position: 2 },
      ]);

      expect((await repository.list()).map((x) => x.id)).toEqual([c.id, a.id, b.id]);
    });

    it("deletes an artwork", async () => {
      const artwork = buildArtwork();
      await repository.save(artwork);

      await repository.delete(artwork.id);

      expect(await repository.findById(artwork.id)).toBeNull();
    });
  });
}
