import { existsSync } from "node:fs";

/** Loads .env.local for CLI scripts (drizzle-kit, seed). Next.js loads it on its own. */
export function loadLocalEnv(): void {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
