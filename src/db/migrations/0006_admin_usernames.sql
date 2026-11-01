CREATE TYPE "public"."admin_role" AS ENUM('owner', 'admin');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "admin_role" DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing admins become owners. Their username is the part of the email before "@", limited
-- to [a-z0-9._-], padded to 3 characters and numbered when two emails share it. They can still
-- log in with the email.
WITH base AS (
  SELECT
    id,
    created_at,
    left(
      CASE
        WHEN length(clean) < 3 THEN clean || '-admin'
        ELSE clean
      END,
      28
    ) AS name
  FROM (
    SELECT
      id,
      created_at,
      regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g') AS clean
    FROM "users"
  ) cleaned
),
numbered AS (
  SELECT id, name, row_number() OVER (PARTITION BY name ORDER BY created_at, id) AS n FROM base
)
UPDATE "users" u
SET
  "username" = numbered.name || CASE WHEN numbered.n > 1 THEN '-' || numbered.n ELSE '' END,
  "role" = 'owner'
FROM numbered
WHERE numbered.id = u.id;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
