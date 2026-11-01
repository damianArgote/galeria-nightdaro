CREATE TYPE "public"."patreon_event_kind" AS ENUM('alta', 'baja', 'cambio');--> statement-breakpoint
CREATE TABLE "patreon_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" "patreon_event_kind" NOT NULL,
	"member_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"patreon_tier_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "patreon_events_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "patreon_members" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"tier_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"pledge_start" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patreon_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"url" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tiers" ADD COLUMN "patreon_tier_id" text;--> statement-breakpoint
CREATE INDEX "patreon_events_kind_occurred_at_idx" ON "patreon_events" USING btree ("kind","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tiers_patreon_tier_id_idx" ON "tiers" USING btree ("patreon_tier_id");