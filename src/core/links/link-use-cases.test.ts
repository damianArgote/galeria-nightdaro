import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  FakeTierRepository,
  FakeTrackingLinkRepository,
} from "@/infra/links/fake-link-repositories";
import { ConflictError, NotFoundError } from "../shared/errors";
import { CreateTier } from "./create-tier";
import { CreateTrackingLink } from "./create-tracking-link";
import { DeleteTier } from "./delete-tier";
import { DeleteTrackingLink } from "./delete-tracking-link";
import { UpdateTier } from "./update-tier";
import { UpdateTrackingLink } from "./update-tracking-link";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

let tiers: FakeTierRepository;
let links: FakeTrackingLinkRepository;

beforeEach(() => {
  tiers = new FakeTierRepository();
  links = new FakeTrackingLinkRepository();
});

const tierInput = {
  platform: "patreon" as const,
  name: "Tinta",
  priceCents: 700,
  currency: "usd",
  url: "https://www.patreon.com/nightdaro",
};

describe("tiers", () => {
  it("creates tiers at the end of the list with an upper-case currency", async () => {
    const create = new CreateTier(tiers);
    await create.execute({ ...tierInput, name: "Boceto" });
    const tier = await create.execute(tierInput);

    expect(tier).toMatchObject({ name: "Tinta", currency: "USD", position: 1 });
    expect(await tiers.findById(tier.id)).toEqual(tier);
  });

  it("updates and deletes a tier", async () => {
    const tier = await new CreateTier(tiers).execute(tierInput);

    const updated = await new UpdateTier(tiers).execute({
      ...tierInput,
      id: tier.id,
      priceCents: 900,
    });
    expect(updated).toMatchObject({ priceCents: 900, position: 0 });

    await new DeleteTier(tiers).execute({ id: tier.id });
    expect(await tiers.list()).toEqual([]);
  });

  it("rejects a second tier with the same name on the same platform", async () => {
    const create = new CreateTier(tiers);
    const tier = await create.execute(tierInput);
    await create.execute({ ...tierInput, platform: "fansly" });

    await expect(create.execute({ ...tierInput, name: "tinta" })).rejects.toThrow(ConflictError);
    await expect(
      new UpdateTier(tiers).execute({ ...tierInput, id: tier.id, priceCents: 800 }),
    ).resolves.toMatchObject({ priceCents: 800 });
  });

  it("creates a tracking link with each tier and follows URL changes", async () => {
    const tier = await new CreateTier(tiers, links).execute(tierInput);

    const [link] = await links.list();
    expect(link).toMatchObject({
      label: "Patreon · Tinta",
      targetUrl: tierInput.url,
      tierId: tier.id,
    });
    expect(link!.code).toMatch(/^[a-z0-9]{6}$/);

    await new UpdateTier(tiers, links).execute({
      ...tierInput,
      id: tier.id,
      url: "https://www.patreon.com/nightdaro/membership",
    });
    expect((await links.findById(link!.id))?.targetUrl).toBe(
      "https://www.patreon.com/nightdaro/membership",
    );
  });

  it("rejects invalid input and unknown ids", async () => {
    await expect(
      new CreateTier(tiers).execute({ ...tierInput, url: "http://insecure.example" }),
    ).rejects.toThrow(ZodError);
    await expect(new CreateTier(tiers).execute({ ...tierInput, priceCents: -1 })).rejects.toThrow(
      ZodError,
    );
    await expect(new UpdateTier(tiers).execute({ ...tierInput, id: MISSING_ID })).rejects.toThrow(
      NotFoundError,
    );
    await expect(new DeleteTier(tiers).execute({ id: MISSING_ID })).rejects.toThrow(NotFoundError);
  });
});

describe("tier benefits and highlight", () => {
  it("stores trimmed benefits in order and defaults to none, not highlighted", async () => {
    const plain = await new CreateTier(tiers).execute(tierInput);
    expect(plain).toMatchObject({ benefits: [], highlighted: false });

    const tier = await new CreateTier(tiers).execute({
      ...tierInput,
      name: "Support",
      benefits: ["  Arte NSFW exclusivo ", "Acceso anticipado"],
    });
    expect((await tiers.findById(tier.id))?.benefits).toEqual([
      "Arte NSFW exclusivo",
      "Acceso anticipado",
    ]);
  });

  it("rejects more than 6 benefits, a benefit over 80 characters and an empty one", async () => {
    const create = new CreateTier(tiers);
    await expect(
      create.execute({ ...tierInput, benefits: Array.from({ length: 7 }, (_, i) => `B${i}`) }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      create.execute({ ...tierInput, benefits: ["x".repeat(81)] }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(create.execute({ ...tierInput, benefits: ["  "] })).rejects.toBeInstanceOf(
      ZodError,
    );
    expect(await tiers.list()).toEqual([]);
  });

  it("keeps a single highlighted tier: highlighting one clears the other", async () => {
    const create = new CreateTier(tiers);
    const support = await create.execute({ ...tierInput, name: "Support", highlighted: true });
    const advanced = await create.execute({ ...tierInput, name: "Advanced support" });

    await new UpdateTier(tiers).execute({ ...tierInput, ...advanced, highlighted: true });

    expect((await tiers.findById(support.id))?.highlighted).toBe(false);
    expect((await tiers.findById(advanced.id))?.highlighted).toBe(true);

    await create.execute({ ...tierInput, name: "Tinta", highlighted: true });
    expect((await tiers.list()).filter((t) => t.highlighted).map((t) => t.name)).toEqual(["Tinta"]);
  });
});

describe("tracking links", () => {
  const linkInput = { label: "Bio de Instagram", targetUrl: "https://www.patreon.com/nightdaro" };

  it("generates a code when none is given, skipping codes in use", async () => {
    const codes = ["taken1", "fresh1"];
    await new CreateTrackingLink(links, tiers).execute({ ...linkInput, code: "taken1" });
    const create = new CreateTrackingLink(links, tiers, undefined, () => codes.shift()!);

    const link = await create.execute(linkInput);

    expect(link).toMatchObject({ code: "fresh1", tierId: null, label: "Bio de Instagram" });
  });

  it("normalizes a given code and links it to an existing tier", async () => {
    const tier = await new CreateTier(tiers).execute(tierInput);

    const link = await new CreateTrackingLink(links, tiers).execute({
      ...linkInput,
      code: "  IG-Bio ",
      tierId: tier.id,
    });

    expect(link).toMatchObject({ code: "ig-bio", tierId: tier.id });
  });

  it("rejects a code in use, an unknown tier and an invalid code", async () => {
    const create = new CreateTrackingLink(links, tiers);
    await create.execute({ ...linkInput, code: "ig-bio" });

    await expect(create.execute({ ...linkInput, code: "ig-bio" })).rejects.toThrow(ConflictError);
    await expect(create.execute({ ...linkInput, tierId: MISSING_ID })).rejects.toThrow(
      ConflictError,
    );
    await expect(create.execute({ ...linkInput, code: "con espacio" })).rejects.toThrow(ZodError);
  });

  it("keeps its own code on update when the code is left empty, and deletes", async () => {
    const link = await new CreateTrackingLink(links, tiers).execute({ ...linkInput, code: "x-1" });
    const update = new UpdateTrackingLink(links, tiers);

    const updated = await update.execute({ ...linkInput, id: link.id, code: "", label: "X bio" });
    expect(updated).toMatchObject({ code: "x-1", label: "X bio" });
    expect((await update.execute({ ...linkInput, id: link.id, code: "x-1" })).code).toBe("x-1");

    await new DeleteTrackingLink(links).execute({ id: link.id });
    expect(await links.list()).toEqual([]);
  });
});
