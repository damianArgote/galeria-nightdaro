import { defineConfig } from "drizzle-kit";
import { loadLocalEnv, requireEnv } from "./src/db/env";

loadLocalEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: requireEnv("DATABASE_URL") },
});
