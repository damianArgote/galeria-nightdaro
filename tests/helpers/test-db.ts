import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDb } from "@/db/client";
import { loadLocalEnv } from "@/db/env";

loadLocalEnv();

/** Base DATABASE_URL; integration suites are skipped when it is not set. */
export const databaseUrl = process.env.DATABASE_URL;

/**
 * Creates (if needed) and migrates a dedicated `<db>_test_<name>` database, so integration
 * suites never touch development data and can run in parallel.
 */
export async function createTestDb(name: string) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for integration tests");

  const url = new URL(databaseUrl);
  const testDbName = `${url.pathname.slice(1)}_test_${name}`;
  const admin = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const [existing] = await admin`select 1 from pg_database where datname = ${testDbName}`;
    if (!existing) await admin.unsafe(`create database "${testDbName}"`);
  } finally {
    await admin.end();
  }

  url.pathname = `/${testDbName}`;
  const { db, close } = createDb(url.toString());
  await migrate(db, { migrationsFolder: "src/db/migrations" });

  async function reset() {
    await db.execute(
      sql`truncate events, tracking_links, tiers, site_settings, media_assets, artworks, users cascade`,
    );
  }

  return { db, close, reset };
}
