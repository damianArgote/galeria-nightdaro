import { pathToFileURL } from "node:url";
import { Argon2PasswordHasher } from "../infra/auth/argon2-password-hasher";
import { createDb, type Db } from "./client";
import { loadLocalEnv, requireEnv } from "./env";
import { siteSettings, tiers, users } from "./schema";

export interface SeedAdmin {
  email: string;
  password: string;
}

// Example tiers until Daro's real Patreon URL and tiers are decided (see "Decisiones abiertas").
const PATREON_URL = "https://www.patreon.com/nightdaro";
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

  for (const admin of admins) {
    await db
      .insert(users)
      .values({
        email: admin.email.toLowerCase(),
        passwordHash: await hasher.hash(admin.password),
      })
      .onConflictDoNothing();
  }
}

async function main() {
  loadLocalEnv();
  const { db, close } = createDb(requireEnv("DATABASE_URL"));
  try {
    await seed(db, [
      { email: requireEnv("SEED_DARO_EMAIL"), password: requireEnv("SEED_DARO_PASSWORD") },
      { email: requireEnv("SEED_DAMI_EMAIL"), password: requireEnv("SEED_DAMI_PASSWORD") },
    ]);
    console.log("Seed completed.");
  } finally {
    await close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
