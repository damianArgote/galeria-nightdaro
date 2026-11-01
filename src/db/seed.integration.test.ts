import { asc } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Argon2PasswordHasher } from "@/infra/auth/argon2-password-hasher";
import { createTestDb, databaseUrl } from "../../tests/helpers/test-db";
import { seed } from "./seed";
import { siteSettings, tiers, trackingLinks, users } from "./schema";

const admins = [
  { username: "Daro", email: "Daro@Example.com", password: "daro-secret" },
  { username: "dami", password: "dami-secret" },
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

  it("links each example tier through a tracking link", async () => {
    await seed(testDb.db, admins);
    await seed(testDb.db, admins);

    const links = await testDb.db.select().from(trackingLinks).orderBy(asc(trackingLinks.code));
    const rows = await testDb.db.select().from(tiers);
    expect(links.map((l) => l.code)).toEqual(["patreon-1", "patreon-2", "patreon-3"]);
    expect(links.every((l) => rows.some((t) => t.id === l.tierId && t.url === l.targetUrl))).toBe(
      true,
    );
  });

  it("creates both admins as owners with argon2id password hashes", async () => {
    await seed(testDb.db, admins);

    const rows = await testDb.db.select().from(users).orderBy(asc(users.username));
    expect(rows.map((u) => [u.username, u.email, u.role, u.mustChangePassword])).toEqual([
      ["dami", null, "owner", false],
      ["daro", "daro@example.com", "owner", false],
    ]);
    for (const user of rows) expect(user.passwordHash).toMatch(/^\$argon2id\$/);

    const daro = rows.find((u) => u.username === "daro")!;
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
