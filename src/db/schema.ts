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

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
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
  },
  (t) => [
    uniqueIndex("tiers_platform_name_idx").on(t.platform, t.name),
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
