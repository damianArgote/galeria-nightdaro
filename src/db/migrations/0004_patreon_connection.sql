CREATE TABLE "patreon_connection" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_url" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"webhook_id" text,
	"webhook_secret" text,
	"connected_at" timestamp with time zone NOT NULL,
	CONSTRAINT "patreon_connection_single_row" CHECK ("patreon_connection"."id" = 1)
);
