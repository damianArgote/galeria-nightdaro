import { seed } from "@/db/seed";
import { createTestDb } from "../tests/helpers/test-db";
import { adminCredentials } from "./helpers";

/** Fresh, seeded e2e database for every run, so tests never touch development data. */
export default async function globalSetup() {
  const testDb = await createTestDb("e2e");
  try {
    await testDb.reset();
    await seed(testDb.db, [adminCredentials()]);
  } finally {
    await testDb.close();
  }
}
