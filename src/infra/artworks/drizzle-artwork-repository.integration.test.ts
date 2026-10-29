import { afterAll, beforeAll, describe } from "vitest";
import { createTestDb, databaseUrl } from "../../../tests/helpers/test-db";
import { describeArtworkRepositoryContract } from "./artwork-repository.contract";
import { DrizzleArtworkRepository } from "./drizzle-artwork-repository";

describe.skipIf(!databaseUrl)("DrizzleArtworkRepository against Postgres", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;

  beforeAll(async () => {
    testDb = await createTestDb("artworks");
  });

  afterAll(async () => {
    await testDb?.close();
  });

  describeArtworkRepositoryContract("DrizzleArtworkRepository", async () => {
    await testDb.reset();
    return new DrizzleArtworkRepository(testDb.db);
  });
});
