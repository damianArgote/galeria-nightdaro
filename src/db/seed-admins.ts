type Env = Record<string, string | undefined>;
type SeedAdmin = { email: string; password: string };

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Admins created by `pnpm db:seed`: Daro and Dami always, a third one when SEED_ADMIN3_* is set. */
export function seedAdminsFromEnv(env: Env): SeedAdmin[] {
  const admins: SeedAdmin[] = [
    { email: required(env, "SEED_DARO_EMAIL"), password: required(env, "SEED_DARO_PASSWORD") },
    { email: required(env, "SEED_DAMI_EMAIL"), password: required(env, "SEED_DAMI_PASSWORD") },
  ];
  // Setting only one of the pair is a typo, not "no third admin".
  if (env.SEED_ADMIN3_EMAIL || env.SEED_ADMIN3_PASSWORD) {
    admins.push({
      email: required(env, "SEED_ADMIN3_EMAIL"),
      password: required(env, "SEED_ADMIN3_PASSWORD"),
    });
  }
  return admins;
}
