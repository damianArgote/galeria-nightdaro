type Env = Record<string, string | undefined>;
type SeedAdmin = { email: string; password: string };

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/**
 * The admin created by `pnpm db:seed`. More admins are added by running the seed again
 * with other credentials: existing admins are left untouched.
 */
export function seedAdminsFromEnv(env: Env): SeedAdmin[] {
  return [
    { email: required(env, "SEED_ADMIN_EMAIL"), password: required(env, "SEED_ADMIN_PASSWORD") },
  ];
}
