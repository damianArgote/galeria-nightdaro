import { createDb } from "./client";
import { loadLocalEnv, requireEnv } from "./env";
import { seed } from "./seed";
import { seedAdminsFromEnv } from "./seed-admins";

async function main() {
  loadLocalEnv();
  const { db, close } = createDb(requireEnv("DATABASE_URL"));
  try {
    await seed(db, seedAdminsFromEnv(process.env));
    console.log("Seed completed.");
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
