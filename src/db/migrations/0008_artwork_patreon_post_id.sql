ALTER TABLE "artworks" ADD COLUMN "patreon_post_id" text;--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_patreon_post_id_unique" UNIQUE("patreon_post_id");