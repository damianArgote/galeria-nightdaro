import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { ARTWORK_KINDS, ARTWORK_RATINGS, ARTWORK_STATUSES } from "../core/artworks/artwork";
import { TIER_PLATFORMS } from "../core/links/tier";
import { PATREON_EVENT_KINDS } from "../core/patreon/patreon";
import { ADMIN_ROLES } from "../core/users/user";
import { MEDIA_STATUSES, MEDIA_TYPES } from "../core/media/media-asset";
import type { SiteSeo, SiteSocials, SiteTheme } from "../core/site/site-settings";

export const artworkKind = pgEnum("artwork_kind", ARTWORK_KINDS);
export const artworkRating = pgEnum("artwork_rating", ARTWORK_RATINGS);
export const artworkStatus = pgEnum("artwork_status", ARTWORK_STATUSES);
export const tierPlatform = pgEnum("tier_platform", TIER_PLATFORMS);
export const mediaType = pgEnum("media_type", MEDIA_TYPES);
export const mediaStatus = pgEnum("media_status", MEDIA_STATUSES);
export const eventType = pgEnum("event_type", ["view", "click", "age_ok"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const adminRole = pgEnum("admin_role", ADMIN_ROLES);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Lowercase, unique; the login. */
  username: text("username").notNull().unique(),
  /** Only admins from before usernames; still accepted as a login. */
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: adminRole("role").notNull().default("admin"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: createdAt(),
});

export const artworks = pgTable(
  "artworks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    kind: artworkKind("kind").notNull(),
    rating: artworkRating("rating").notNull(),
    status: artworkStatus("status").notNull().default("draft"),
    position: integer("position").notNull().default(0),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    patreonPostUrl: text("patreon_post_url"),
    createdAt: createdAt(),
  },
  (t) => [index("artworks_kind_status_position_idx").on(t.kind, t.status, t.position)],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    type: mediaType("type").notNull(),
    originalKey: text("original_key"),
    previewKey: text("preview_key"),
    thumbKey: text("thumb_key"),
    censoredKey: text("censored_key"),
    blurData: text("blur_data"),
    width: integer("width"),
    height: integer("height"),
    streamVideoId: text("stream_video_id"),
    status: mediaStatus("status").notNull().default("processing"),
    renderedRating: artworkRating("rendered_rating"),
    createdAt: createdAt(),
  },
  (t) => [index("media_assets_artwork_id_idx").on(t.artworkId)],
);

export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    name: text("name").notNull(),
    bio: text("bio"),
    bannerMediaId: uuid("banner_media_id").references((): AnyPgColumn => mediaAssets.id, {
      onDelete: "set null",
    }),
    theme: jsonb("theme").$type<SiteTheme>().notNull().default({ accent: "violet" }),
    socials: jsonb("socials").$type<SiteSocials>().notNull().default({}),
    ageGateEnabled: boolean("age_gate_enabled").notNull().default(true),
    seo: jsonb("seo").$type<SiteSeo>().notNull().default({}),
  },
  (t) => [check("site_settings_single_row", sql`${t.id} = 1`)],
);

export const tiers = pgTable(
  "tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: tierPlatform("platform").notNull(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    benefits: text("benefits")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    highlighted: boolean("highlighted").notNull().default(false),
    patreonTierId: text("patreon_tier_id"),
  },
  (t) => [
    uniqueIndex("tiers_platform_name_idx").on(t.platform, t.name),
    // At most one highlighted tier.
    // A Patreon tier is sold by at most one of our tiers.
    uniqueIndex("tiers_patreon_tier_id_idx").on(t.patreonTierId),
    uniqueIndex("tiers_single_highlight_idx")
      .on(t.highlighted)
      .where(sql`${t.highlighted}`),
    index("tiers_position_idx").on(t.position),
  ],
);

export const trackingLinks = pgTable("tracking_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  targetUrl: text("target_url").notNull(),
  label: text("label").notNull(),
  tierId: uuid("tier_id").references(() => tiers.id, { onDelete: "set null" }),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: eventType("type").notNull(),
    artworkId: uuid("artwork_id").references(() => artworks.id, { onDelete: "set null" }),
    linkId: uuid("link_id").references(() => trackingLinks.id, { onDelete: "set null" }),
    sessionHash: text("session_hash").notNull(),
    referrer: text("referrer"),
    country: text("country"),
    createdAt: createdAt(),
  },
  (t) => [
    index("events_type_created_at_idx").on(t.type, t.createdAt),
    index("events_artwork_id_idx").on(t.artworkId),
    index("events_link_id_idx").on(t.linkId),
  ],
);

/**
 * The site's single Patreon connection (row id 1). Tokens and the webhook secret are stored
 * encrypted with AES-256-GCM (src/infra/patreon/token-cipher.ts), never in clear.
 */
export const patreonConnection = pgTable(
  "patreon_connection",
  {
    id: integer("id").primaryKey().default(1),
    campaignId: text("campaign_id").notNull(),
    campaignUrl: text("campaign_url").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    webhookId: text("webhook_id"),
    webhookSecret: text("webhook_secret"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull(),
  },
  (t) => [check("patreon_connection_single_row", sql`${t.id} = 1`)],
);

/** Daro's tiers as Patreon reports them (names and prices for the Resumen and the panel). */
export const patreonTiers = pgTable("patreon_tiers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  amountCents: integer("amount_cents").notNull(),
  url: text("url"),
  position: integer("position").notNull().default(0),
});

/** Current state of each patron. Only Patreon's member id: never a name or an email. */
export const patreonMembers = pgTable("patreon_members", {
  id: text("id").primaryKey(),
  status: text("status"),
  amountCents: integer("amount_cents").notNull().default(0),
  tierIds: text("tier_ids")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  pledgeStart: timestamp("pledge_start", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const patreonEventKind = pgEnum("patreon_event_kind", PATREON_EVENT_KINDS);

/** One row per pledge webhook delivery; `key` makes Patreon's retries count once. */
export const patreonEvents = pgTable(
  "patreon_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    kind: patreonEventKind("kind").notNull(),
    memberId: text("member_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    patreonTierId: text("patreon_tier_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("patreon_events_kind_occurred_at_idx").on(t.kind, t.occurredAt)],
);
