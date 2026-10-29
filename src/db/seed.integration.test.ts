import { asc } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Argon2PasswordHasher } from "@/infra/auth/argon2-password-hasher";
import { createTestDb, databaseUrl } from "../../tests/helpers/test-db";
import { seed } from "./seed";
import { siteSettings, tiers, users } from "./schema";

const admins = [
  { email: "Daro@Example.com", password: "daro-secret" },
  { email: "dami@example.com", password: "dami-secret" },
];

describe.skipIf(!databaseUrl)("seed", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;

  beforeAll(async () => {
    testDb = await createTestDb("seed");
  });

  beforeEach(async () => {
    await testDb.reset();
  });

  afterAll(async () => {
    await testDb?.close();
  });

  it("creates NightDaro site settings with its socials", async () => {
    await seed(testDb.db, admins);

    const rows = await testDb.db.select().from(siteSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      name: "NightDaro",
      ageGateEnabled: true,
      socials: {
        instagram: "https://www.instagram.com/nightdaro",
        x: "https://x.com/nightcrowller3",
      },
    });
  });

  it("creates the three example Patreon tiers at US$5, 10 and 20", async () => {
    await seed(testDb.db, admins);

    const rows = await testDb.db.select().from(tiers).orderBy(asc(tiers.position));
    expect(rows.map((t) => [t.platform, t.priceCents, t.currency])).toEqual([
      ["patreon", 500, "USD"],
      ["patreon", 1000, "USD"],
      ["patreon", 2000, "USD"],
    ]);
  });

  it("creates both admins with argon2id password hashes", async () => {
    await seed(testDb.db, admins);

    const rows = await testDb.db.select().from(users).orderBy(asc(users.email));
    expect(rows.map((u) => u.email)).toEqual(["dami@example.com", "daro@example.com"]);
    for (const user of rows) expect(user.passwordHash).toMatch(/^\$argon2id\$/);

    const daro = rows.find((u) => u.email === "daro@example.com")!;
    expect(await new Argon2PasswordHasher().verify("daro-secret", daro.passwordHash)).toBe(true);
    expect(await new Argon2PasswordHasher().verify("wrong", daro.passwordHash)).toBe(false);
  });

  it("is idempotent", async () => {
    await seed(testDb.db, admins);
    await seed(testDb.db, admins);

    expect(await testDb.db.select().from(siteSettings)).toHaveLength(1);
    expect(await testDb.db.select().from(tiers)).toHaveLength(3);
    expect(await testDb.db.select().from(users)).toHaveLength(2);
  });
});
