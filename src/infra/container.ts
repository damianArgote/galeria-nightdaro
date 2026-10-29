// Composition root: wires core use cases to their infra adapters.
import "server-only";
import { AuthenticateAdmin } from "@/core/users/authenticate-admin";
import { createDb, type Db } from "@/db/client";
import { requireEnv } from "@/db/env";
import { Argon2PasswordHasher } from "./auth/argon2-password-hasher";
import { RateLimiter } from "./auth/rate-limiter";
import { DrizzleUserRepository } from "./users/drizzle-user-repository";

let db: Db | undefined;

// Lazy so that `next build` does not need DATABASE_URL.
function getDb(): Db {
  db ??= createDb(requireEnv("DATABASE_URL")).db;
  return db;
}

const passwordHasher = new Argon2PasswordHasher();

export const container = {
  get authenticateAdmin() {
    return new AuthenticateAdmin(new DrizzleUserRepository(getDb()), passwordHasher);
  },
  passwordHasher,
  /** 5 login attempts per minute per IP. */
  loginRateLimiter: new RateLimiter({ limit: 5, windowMs: 60_000 }),
};
