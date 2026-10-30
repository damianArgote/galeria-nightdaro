import sharp from "sharp";
import type { ArtworkKind, ArtworkRating } from "../core/artworks/artwork";
import { CreateArtwork } from "../core/artworks/create-artwork";
import { PublishArtwork } from "../core/artworks/publish-artwork";
import { UploadArtworkImage } from "../core/media/upload-artwork-image";
import { DrizzleArtworkRepository } from "../infra/artworks/drizzle-artwork-repository";
import { DrizzleMediaAssetRepository } from "../infra/media/drizzle-media-asset-repository";
import { SharpImageProcessor } from "../infra/media/sharp-image-processor";
import { LocalStorageAdapter } from "../infra/media/storage-adapters";
import type { Db } from "./client";

interface DemoArtwork {
  title: string;
  description: string;
  kind: ArtworkKind;
  rating: ArtworkRating;
  colors: [string, string];
  tags: string[];
}

/** Example artworks for local development and e2e: published, with generated images. */
export const DEMO_ARTWORKS: DemoArtwork[] = [
  {
    title: "Calabaza Pin-up",
    description: "Color digital · Halloween",
    kind: "finished",
    rating: "sfw",
    colors: ["#b14dff", "#22e4ff"],
    tags: ["halloween", "color"],
  },
  {
    title: "Demonio de gafas (busto)",
    description: "Recorte apto para todo público",
    kind: "finished",
    rating: "sfw",
    colors: ["#ff4fd8", "#b14dff"],
    tags: ["demonio"],
  },
  {
    title: "Bruja del cementerio",
    description: "Color digital · versión sugerente",
    kind: "finished",
    rating: "suggestive",
    colors: ["#39ff88", "#b14dff"],
    tags: ["bruja"],
  },
  {
    title: "Súcubo de tinta",
    description: "Tinta tradicional · la versión completa está en Patreon",
    kind: "finished",
    rating: "explicit",
    colors: ["#ff4fd8", "#2a5cff"],
    tags: ["tinta", "súcubo"],
  },
  {
    title: "Kitsune de invierno",
    description: "Boceto",
    kind: "wip",
    rating: "sfw",
    colors: ["#22e4ff", "#f3eee6"],
    tags: ["boceto"],
  },
  {
    title: "Súcubo II",
    description: "Color base",
    kind: "wip",
    rating: "explicit",
    colors: ["#b14dff", "#39ff88"],
    tags: ["color"],
  },
];

async function demoImage([a, b]: [string, string]): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1125">
    <defs>
      <radialGradient id="g1" cx="40%" cy="38%" r="55%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#150b42" stop-opacity="0"/></radialGradient>
      <radialGradient id="g2" cx="65%" cy="78%" r="45%"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="#07041a" stop-opacity="0"/></radialGradient>
      <pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="2" fill="#000" opacity=".35"/></pattern>
    </defs>
    <rect width="100%" height="100%" fill="#150b42"/>
    <rect width="100%" height="100%" fill="url(#g1)"/>
    <rect width="100%" height="100%" fill="url(#g2)"/>
    <rect width="100%" height="100%" fill="url(#dots)"/>
    <circle cx="450" cy="480" r="190" fill="none" stroke="#000" stroke-width="18" opacity=".6"/>
    <path d="M300 820 Q450 700 600 820" fill="none" stroke="#000" stroke-width="18" opacity=".6"/>
  </svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer());
}

/** Idempotent: an artwork whose title already exists is skipped. */
export async function seedDemo(db: Db, storageRoot: string): Promise<number> {
  const artworks = new DrizzleArtworkRepository(db);
  const upload = new UploadArtworkImage({
    artworks,
    media: new DrizzleMediaAssetRepository(db),
    storage: new LocalStorageAdapter(storageRoot),
    images: new SharpImageProcessor(),
    keyPrefix: "nightdaro",
  });
  const existing = new Set((await artworks.list()).map((a) => a.title));

  let created = 0;
  for (const demo of DEMO_ARTWORKS) {
    if (existing.has(demo.title)) continue;
    const artwork = await new CreateArtwork(artworks).execute(demo);
    await upload.execute({
      artworkId: artwork.id,
      image: await demoImage(demo.colors),
      charactersAreAdults: true,
    });
    await new PublishArtwork(artworks).execute({ id: artwork.id });
    created++;
  }
  return created;
}
