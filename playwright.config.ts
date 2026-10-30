import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3100;
export const E2E_STORAGE_DIR = ".storage/e2e";
/** Admin session saved once by e2e/auth.setup.ts; the login rate limit stays real. */
export const ADMIN_STATE = `${E2E_STORAGE_DIR}/admin-state.json`;

// The app under test uses its own database (see e2e/global-setup.ts).
function e2eDatabaseUrl() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for e2e tests");
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname}_test_e2e`;
  return url.toString();
}
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
  webServer: {
    // CI builds in an earlier step; locally build first so tests run against production output.
    command: isCI ? `pnpm start -p ${PORT}` : `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET || "e2e-only-secret-not-for-production",
      AUTH_TRUST_HOST: "true",
      DATABASE_URL: e2eDatabaseUrl(),
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_DIR: E2E_STORAGE_DIR,
    },
  },
});
