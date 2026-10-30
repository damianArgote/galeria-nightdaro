import { localStorageRoot, storageDriver } from "../infra/media/media-config";
import { createDb } from "./client";
import { loadLocalEnv, requireEnv } from "./env";
import { seedDemo } from "./seed-demo";

async function main() {
  loadLocalEnv();
  if (storageDriver() !== "local") {
    throw new Error("The demo seed only writes to local storage (STORAGE_DRIVER=local).");
  }
  const { db, close } = createDb(requireEnv("DATABASE_URL"));
  try {
    const created = await seedDemo(db, localStorageRoot());
    console.log(`Demo seed completed: ${created} artworks created.`);
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
