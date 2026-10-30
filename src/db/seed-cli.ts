import { createDb } from "./client";
import { loadLocalEnv, requireEnv } from "./env";
import { seed } from "./seed";

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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
