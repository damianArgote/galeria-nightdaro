ALTER TABLE "tiers" ADD COLUMN "benefits" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "tiers" ADD COLUMN "highlighted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tiers_single_highlight_idx" ON "tiers" USING btree ("highlighted") WHERE "tiers"."highlighted";