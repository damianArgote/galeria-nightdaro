import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { FakeArtworkRepository } from "@/infra/artworks/fake-artwork-repository";
import { ConflictError, NotFoundError } from "../shared/errors";
import { CreateArtwork } from "./create-artwork";
import { DeleteArtwork } from "./delete-artwork";
import { HideArtwork } from "./hide-artwork";
import { PublishArtwork } from "./publish-artwork";
import { ReorderGallery } from "./reorder-gallery";
import { UpdateArtwork } from "./update-artwork";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";
const NOW = new Date("2026-10-30T12:00:00.000Z");

let repo: FakeArtworkRepository;
let create: CreateArtwork;

beforeEach(() => {
  repo = new FakeArtworkRepository();
  create = new CreateArtwork(repo);
});

const newArtwork = (title: string, kind: "finished" | "wip" | "timelapse" = "finished") =>
  create.execute({ title, kind, rating: "sfw" });

describe("CreateArtwork", () => {
  it("creates a draft with a slug from the title, at the end of its tab", async () => {
    await newArtwork("Primera");
    const artwork = await create.execute({
      title: "  Noche de Neón ",
      description: "  ",
      kind: "finished",
      rating: "suggestive",
      tags: ["manga", "manga", "neon"],
    });

    expect(artwork).toMatchObject({
      title: "Noche de Neón",
      slug: "noche-de-neon",
      description: null,
      status: "draft",
      position: 1,
      tags: ["manga", "neon"],
      publishedAt: null,
    });
    expect(await repo.findById(artwork.id)).toEqual(artwork);
  });

  it("numbers repeated slugs", async () => {
    await newArtwork("Bruja");
    const second = await newArtwork("Bruja");
    const third = await newArtwork("Bruja");

    expect([second.slug, third.slug]).toEqual(["bruja-2", "bruja-3"]);
  });

  it("counts positions per tab", async () => {
    await newArtwork("A");
    const wip = await newArtwork("B", "wip");

    expect(wip.position).toBe(0);
  });

  it("rejects a missing title or rating", async () => {
    await expect(create.execute({ title: " ", kind: "wip", rating: "sfw" })).rejects.toThrow(
      ZodError,
    );
    await expect(
      create.execute({ title: "X", kind: "wip" } as unknown as Parameters<
        CreateArtwork["execute"]
      >[0]),
    ).rejects.toThrow(ZodError);
  });
});

describe("UpdateArtwork", () => {
  it("edits the fields and follows the title in the slug while it is a draft", async () => {
    const artwork = await newArtwork("Boceto");

    const updated = await new UpdateArtwork(repo).execute({
      id: artwork.id,
      title: "Kitsune",
      description: "Tinta",
      kind: "finished",
      rating: "explicit",
      tags: ["zorro"],
    });

    expect(updated).toMatchObject({
      slug: "kitsune",
      description: "Tinta",
      rating: "explicit",
      tags: ["zorro"],
    });
  });

  it("keeps the slug once published", async () => {
    const artwork = await newArtwork("Boceto");
    await new PublishArtwork(repo).execute({ id: artwork.id });

    const updated = await new UpdateArtwork(repo).execute({
      id: artwork.id,
      title: "Otro nombre",
      kind: "finished",
      rating: "sfw",
    });

    expect(updated.slug).toBe("boceto");
  });

  it("moves the artwork to the end of its new tab", async () => {
    await newArtwork("W1", "wip");
    const artwork = await newArtwork("F1");

    const updated = await new UpdateArtwork(repo).execute({
      id: artwork.id,
      title: "F1",
      kind: "wip",
      rating: "sfw",
    });

    expect(updated.position).toBe(1);
  });

  it("fails for an unknown id", async () => {
    await expect(
      new UpdateArtwork(repo).execute({ id: MISSING_ID, title: "X", kind: "wip", rating: "sfw" }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("PublishArtwork and HideArtwork", () => {
  it("publishes with the current date and keeps the first date when republished", async () => {
    const artwork = await newArtwork("Obra");
    const publish = new PublishArtwork(repo, () => NOW);

    const published = await publish.execute({ id: artwork.id });
    expect(published).toMatchObject({ status: "published", publishedAt: NOW });

    const hidden = await new HideArtwork(repo).execute({ id: artwork.id });
    expect(hidden).toMatchObject({ status: "hidden", publishedAt: NOW });

    const later = new PublishArtwork(repo, () => new Date("2027-01-01T00:00:00.000Z"));
    expect((await later.execute({ id: artwork.id })).publishedAt).toEqual(NOW);
  });

  it("fail for an unknown or invalid id", async () => {
    await expect(new PublishArtwork(repo).execute({ id: MISSING_ID })).rejects.toThrow(
      NotFoundError,
    );
    await expect(new HideArtwork(repo).execute({ id: "not-a-uuid" })).rejects.toThrow(ZodError);
  });
});

describe("DeleteArtwork", () => {
  it("deletes the artwork", async () => {
    const artwork = await newArtwork("Obra");

    await new DeleteArtwork(repo).execute({ id: artwork.id });

    expect(await repo.findById(artwork.id)).toBeNull();
    await expect(new DeleteArtwork(repo).execute({ id: artwork.id })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("ReorderGallery", () => {
  it("sets the order of one tab without touching the others", async () => {
    const a = await newArtwork("A");
    const b = await newArtwork("B");
    const c = await newArtwork("C");
    const wip = await newArtwork("W", "wip");

    await new ReorderGallery(repo).execute({ kind: "finished", ids: [c.id, a.id, b.id] });

    expect((await repo.list({ kind: "finished" })).map((x) => x.title)).toEqual(["C", "A", "B"]);
    expect((await repo.findById(wip.id))?.position).toBe(0);
  });

  it("rejects a list that does not match the tab exactly", async () => {
    const a = await newArtwork("A");
    const b = await newArtwork("B");
    const wip = await newArtwork("W", "wip");
    const reorder = new ReorderGallery(repo);

    for (const ids of [[a.id], [a.id, b.id, wip.id], [a.id, a.id], [a.id, wip.id]]) {
      await expect(reorder.execute({ kind: "finished", ids })).rejects.toThrow(ConflictError);
    }
    expect((await repo.list({ kind: "finished" })).map((x) => x.id)).toEqual([a.id, b.id]);
  });
});
