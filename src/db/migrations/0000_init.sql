CREATE TYPE "public"."artwork_kind" AS ENUM('finished', 'wip', 'timelapse');--> statement-breakpoint
CREATE TYPE "public"."artwork_rating" AS ENUM('sfw', 'suggestive', 'explicit');--> statement-breakpoint
CREATE TYPE "public"."artwork_status" AS ENUM('draft', 'published', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('view', 'click', 'age_ok');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."tier_platform" AS ENUM('patreon', 'onlyfans', 'fansly');--> statement-breakpoint
CREATE TABLE "artworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" "artwork_kind" NOT NULL,
	"rating" "artwork_rating" NOT NULL,
	"status" "artwork_status" DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artworks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "event_type" NOT NULL,
	"artwork_id" uuid,
	"link_id" uuid,
	"session_hash" text NOT NULL,
	"referrer" text,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid NOT NULL,
	"type" "media_type" NOT NULL,
	"original_key" text,
	"preview_key" text,
	"thumb_key" text,
	"censored_key" text,
	"blur_data" text,
	"width" integer,
	"height" integer,
	"stream_video_id" text,
	"status" "media_status" DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"banner_media_id" uuid,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"age_gate_enabled" boolean DEFAULT true NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "site_settings_single_row" CHECK ("site_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "tier_platform" NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"target_url" text NOT NULL,
	"label" text NOT NULL,
	"tier_id" uuid,
	CONSTRAINT "tracking_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_link_id_tracking_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."tracking_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_banner_media_id_media_assets_id_fk" FOREIGN KEY ("banner_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_links" ADD CONSTRAINT "tracking_links_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artworks_kind_status_position_idx" ON "artworks" USING btree ("kind","status","position");--> statement-breakpoint
CREATE INDEX "events_type_created_at_idx" ON "events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "events_artwork_id_idx" ON "events" USING btree ("artwork_id");--> statement-breakpoint
CREATE INDEX "events_link_id_idx" ON "events" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "media_assets_artwork_id_idx" ON "media_assets" USING btree ("artwork_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tiers_platform_name_idx" ON "tiers" USING btree ("platform","name");--> statement-breakpoint
CREATE INDEX "tiers_position_idx" ON "tiers" USING btree ("position");