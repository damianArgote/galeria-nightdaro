import { USERNAME_PATTERN, normalizeUsername, usernameFromEmail } from "../core/users/user";
import type { SeedAdmin } from "./seed";

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/**
 * The owner created by `pnpm db:seed`: SEED_ADMIN_USERNAME, or SEED_ADMIN_EMAIL (its part before
 * "@" becomes the username and the email stays valid as a login). Other admins are created from
 * the panel; running the seed again leaves existing admins untouched.
 */
export function seedAdminsFromEnv(env: Env): SeedAdmin[] {
  const password = required(env, "SEED_ADMIN_PASSWORD");
  if (env.SEED_ADMIN_USERNAME) {
    const username = normalizeUsername(env.SEED_ADMIN_USERNAME);
    if (!USERNAME_PATTERN.test(username)) {
      throw new Error("SEED_ADMIN_USERNAME: 3 to 32 lowercase letters, digits, . _ or -");
    }
    return [{ username, password }];
  }
  const email = env.SEED_ADMIN_EMAIL;
  if (!email) throw new Error("Missing environment variable SEED_ADMIN_USERNAME");
  return [{ username: usernameFromEmail(email), email, password }];
}
