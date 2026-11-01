import { Argon2PasswordHasher } from "../infra/auth/argon2-password-hasher";
import type { Db } from "./client";
import { siteSettings, tiers, trackingLinks, users } from "./schema";

/** The seeded admins are owners: they create the other admins from the panel. */
export interface SeedAdmin {
  username: string;
  email?: string;
  password: string;
}

// Daro's Patreon; the tiers are examples until the real ones are decided (see "Decisiones abiertas").
const PATREON_URL = "https://www.patreon.com/cw/Ndaro";
/** Presentation text of the visual reference; editable in /admin/pagina. */
export const DEFAULT_BIO =
  "Súcubos, chicas de Halloween y demonios de tinta. Acá ves los avances y los bocetos; las versiones completas, en alta resolución y sin censura, están en Patreon.";

const EXAMPLE_TIERS = [
  { name: "Tier 1", priceCents: 500, position: 0 },
  { name: "Tier 2", priceCents: 1000, position: 1 },
  { name: "Tier 3", priceCents: 2000, position: 2 },
];

/** Idempotent: running it twice leaves the same rows and never overwrites existing ones. */
export async function seed(db: Db, admins: SeedAdmin[]): Promise<void> {
  const hasher = new Argon2PasswordHasher();
  await db
    .insert(siteSettings)
    .values({
      id: 1,
      name: "NightDaro",
      bio: DEFAULT_BIO,
      socials: {
        instagram: "https://www.instagram.com/nightdaro",
        x: "https://x.com/nightcrowller3",
      },
    })
    .onConflictDoNothing();

  await db
    .insert(tiers)
    .values(
      EXAMPLE_TIERS.map((tier) => ({
        ...tier,
        platform: "patreon" as const,
        currency: "USD",
        url: PATREON_URL,
      })),
    )
    .onConflictDoNothing();

  // The gallery links each tier through /r/{code}, never to the platform directly.
  const seededTiers = await db.select().from(tiers);
  for (const [i, example] of EXAMPLE_TIERS.entries()) {
    const tier = seededTiers.find((t) => t.platform === "patreon" && t.name === example.name);
    if (!tier) continue;
    await db
      .insert(trackingLinks)
      .values({
        code: `patreon-${i + 1}`,
        label: `Patreon · ${tier.name}`,
        targetUrl: tier.url,
        tierId: tier.id,
      })
      .onConflictDoNothing();
  }

  for (const admin of admins) {
    await db
      .insert(users)
      .values({
        username: admin.username.trim().toLowerCase(),
        email: admin.email?.trim().toLowerCase() ?? null,
        passwordHash: await hasher.hash(admin.password),
        role: "owner",
      })
      .onConflictDoNothing();
  }
}
