import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PatreonConnection } from "@/core/patreon/patreon";
import { createTestDb, databaseUrl } from "../../../tests/helpers/test-db";
import { DrizzlePatreonConnectionRepository } from "./drizzle-patreon-connection-repository";
import { TokenCipher } from "./token-cipher";

const connection: PatreonConnection = {
  campaignId: "camp-1",
  campaignUrl: "https://www.patreon.com/cw/Ndaro",
  tokens: {
    accessToken: "access-secret-value",
    refreshToken: "refresh-secret-value",
    expiresAt: new Date("2026-12-01T00:00:00Z"),
  },
  webhook: { id: "wh-1", secret: "webhook-secret-value" },
  connectedAt: new Date("2026-11-01T12:00:00Z"),
};

describe.skipIf(!databaseUrl)("Patreon connection against Postgres", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let repository: DrizzlePatreonConnectionRepository;

  beforeAll(async () => {
    testDb = await createTestDb("patreon");
  });

  beforeEach(async () => {
    await testDb.reset();
    repository = new DrizzlePatreonConnectionRepository(
      testDb.db,
      new TokenCipher("integration-test-secret"),
    );
  });

  afterAll(async () => {
    await testDb?.close();
  });

  it("round-trips the connection and keeps a single row", async () => {
    expect(await repository.get()).toBeNull();
    await repository.save(connection);
    await repository.save({ ...connection, webhook: null });

    expect(await repository.get()).toEqual({ ...connection, webhook: null });
    const [{ count }] = (await testDb.db.execute(
      sql`select count(*)::int as count from patreon_connection`,
    )) as unknown as [{ count: number }];
    expect(count).toBe(1);

    await repository.save(connection);
    expect(await repository.webhookSecret()).toBe("webhook-secret-value");

    await repository.delete();
    expect(await repository.get()).toBeNull();
    expect(await repository.webhookSecret()).toBeNull();
  });

  it("never stores tokens or the webhook secret in clear", async () => {
    await repository.save(connection);
    const rows = await testDb.db.execute(sql`select * from patreon_connection`);
    const raw = JSON.stringify(rows);

    for (const secret of ["access-secret-value", "refresh-secret-value", "webhook-secret-value"]) {
      expect(raw).not.toContain(secret);
    }
  });
});
