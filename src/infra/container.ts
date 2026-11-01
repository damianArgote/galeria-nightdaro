// Composition root: wires core use cases to their infra adapters.
import "server-only";
import { sql } from "drizzle-orm";
import { GetAnalyticsSummary } from "@/core/analytics/get-analytics-summary";
import { RecordClick, RecordClientEvent } from "@/core/analytics/record-event";
import { CreateArtwork } from "@/core/artworks/create-artwork";
import { DeleteArtwork } from "@/core/artworks/delete-artwork";
import { HideArtwork } from "@/core/artworks/hide-artwork";
import { ListArtworks } from "@/core/artworks/list-artworks";
import { PublishArtwork } from "@/core/artworks/publish-artwork";
import { ReorderGallery } from "@/core/artworks/reorder-gallery";
import { UpdateArtwork } from "@/core/artworks/update-artwork";
import { CreateTier } from "@/core/links/create-tier";
import { CreateTrackingLink } from "@/core/links/create-tracking-link";
import { DeleteTier } from "@/core/links/delete-tier";
import { DeleteTrackingLink } from "@/core/links/delete-tracking-link";
import { ListTiers } from "@/core/links/list-tiers";
import { ListTrackingLinks } from "@/core/links/list-tracking-links";
import { UpdateTier } from "@/core/links/update-tier";
import { UpdateTrackingLink } from "@/core/links/update-tracking-link";
import {
  CountPublicGallery,
  GetPublicArtwork,
  ListPublicGallery,
  ListPublicTags,
  ResolvePublicMedia,
} from "@/core/gallery/public-gallery";
import { ListPublicTiers } from "@/core/gallery/public-tiers";
import { ListArtworkImages } from "@/core/media/list-artwork-images";
import { ListArtworkVideos } from "@/core/media/list-artwork-videos";
import { RerenderArtworkImage } from "@/core/media/rerender-artwork-image";
import { StartTimelapseUpload } from "@/core/media/start-timelapse-upload";
import { SyncVideoStatus } from "@/core/media/sync-video-status";
import { EnsureTimelapseCovers } from "@/core/media/timelapse-covers";
import { UploadArtworkImage } from "@/core/media/upload-artwork-image";
import {
  CompletePatreonConnect,
  DisconnectPatreon,
  GetPatreonStatus,
  PatreonAccess,
  StartPatreonConnect,
} from "@/core/patreon/connect";
import { GetPatreonSummary } from "@/core/patreon/summary";
import { RecordPatreonPledge, SetUpPatreonCampaign } from "@/core/patreon/sync";
import { InvalidInputError } from "@/core/shared/errors";
import { GetSiteSettings } from "@/core/site/get-site-settings";
import { UpdateSiteSettings } from "@/core/site/update-site-settings";
import { AuthenticateAdmin } from "@/core/users/authenticate-admin";
import { ChangeOwnPassword } from "@/core/users/change-password";
import {
  CreateAdmin,
  ListAdmins,
  ResetAdminPassword,
  SetAdminActive,
} from "@/core/users/manage-admins";
import { createDb, type Db } from "@/db/client";
import { requireEnv } from "@/db/env";
import { DrizzleEventRepository } from "./analytics/drizzle-event-repository";
import { DrizzleArtworkRepository } from "./artworks/drizzle-artwork-repository";
import { Argon2PasswordHasher } from "./auth/argon2-password-hasher";
import { RateLimiter } from "./auth/rate-limiter";
import {
  DrizzleTierRepository,
  DrizzleTrackingLinkRepository,
} from "./links/drizzle-link-repositories";
import { DrizzlePatreonConnectionRepository } from "./patreon/drizzle-patreon-connection-repository";
import {
  DrizzlePatreonEventRepository,
  DrizzlePatreonMemberRepository,
  DrizzlePatreonTierCatalog,
} from "./patreon/drizzle-patreon-repositories";
import { patreonSetup } from "./patreon/patreon-config";
import { DrizzleMediaAssetRepository } from "./media/drizzle-media-asset-repository";
import { createStorage, createUrlSigner, createVideoPort } from "./media/media-config";
import { SharpImageProcessor } from "./media/sharp-image-processor";
import { DrizzleSiteSettingsRepository } from "./site/drizzle-site-settings-repository";
import { DrizzleUserRepository } from "./users/drizzle-user-repository";

let db: Db | undefined;

// Lazy so that `next build` does not need DATABASE_URL.
function getDb(): Db {
  db ??= createDb(requireEnv("DATABASE_URL")).db;
  return db;
}

const passwordHasher = new Argon2PasswordHasher();

const artworks = () => new DrizzleArtworkRepository(getDb());
const siteSettings = () => new DrizzleSiteSettingsRepository(getDb());
const tiers = () => new DrizzleTierRepository(getDb());
const trackingLinks = () => new DrizzleTrackingLinkRepository(getDb());
const mediaAssets = () => new DrizzleMediaAssetRepository(getDb());
const events = () => new DrizzleEventRepository(getDb());

const imageProcessor = new SharpImageProcessor();
/** Every storage key starts with the tenant folder (see "Preparado para el SaaS"). */
const STORAGE_KEY_PREFIX = "nightdaro";

function publicDeps() {
  return {
    artworks: artworks(),
    images: new ListArtworkImages(mediaAssets(), createUrlSigner()),
    videos: new ListArtworkVideos(mediaAssets(), createVideoPort()),
  };
}

/** Null while the Patreon client is not configured: the panel says so instead of failing. */
function patreon() {
  let setup: ReturnType<typeof patreonSetup>;
  try {
    setup = patreonSetup();
  } catch (error) {
    // Client set but PATREON_TOKEN_KEY or SITE_URL missing: only the Patreon panel says so.
    console.error("Patreon is misconfigured", error);
    return null;
  }
  if (!setup) return null;
  const connections = new DrizzlePatreonConnectionRepository(getDb(), setup.cipher);
  const members = new DrizzlePatreonMemberRepository(getDb());
  const catalog = new DrizzlePatreonTierCatalog(getDb());
  return {
    /** Patreon's tiers as last read, to link ours by hand in the panel. */
    listPatreonTiers: () => catalog.list(),
    start: new StartPatreonConnect(setup.port, setup.redirectUri),
    complete: new CompletePatreonConnect(setup.port, connections, setup.redirectUri),
    setUp: new SetUpPatreonCampaign({
      patreon: setup.port,
      access: new PatreonAccess(setup.port, connections),
      connections,
      catalog,
      members,
      tiers: tiers(),
      webhookUri: setup.webhookUri,
    }),
    recordPledge: new RecordPatreonPledge({
      patreon: setup.port,
      access: new PatreonAccess(setup.port, connections),
      members,
      events: new DrizzlePatreonEventRepository(getDb()),
    }),
    summary: new GetPatreonSummary(
      new DrizzlePatreonEventRepository(getDb()),
      members,
      catalog,
      tiers(),
    ),
    /** The secret Patreon signs webhooks with; null until the webhook exists. */
    webhookSecret: () => connections.webhookSecret(),
    disconnect: new DisconnectPatreon(setup.port, connections),
    status: new GetPatreonStatus(connections),
  };
}

function requireVideoPort() {
  const video = createVideoPort();
  if (!video) {
    throw new InvalidInputError(
      "Los timelapses necesitan Bunny Stream: configurá BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY y BUNNY_STREAM_TOKEN_KEY.",
    );
  }
  return video;
}

export const container = {
  /** Health check: the database answers. */
  async ping(): Promise<void> {
    await getDb().execute(sql`select 1`);
  },

  get authenticateAdmin() {
    return new AuthenticateAdmin(new DrizzleUserRepository(getDb()), passwordHasher);
  },
  /** The admin behind a session, read on every request by requireAdmin. */
  findAdmin(id: string) {
    return new DrizzleUserRepository(getDb()).findById(id);
  },
  get createAdmin() {
    return new CreateAdmin(new DrizzleUserRepository(getDb()), passwordHasher);
  },
  get resetAdminPassword() {
    return new ResetAdminPassword(new DrizzleUserRepository(getDb()), passwordHasher);
  },
  get setAdminActive() {
    return new SetAdminActive(new DrizzleUserRepository(getDb()));
  },
  get listAdmins() {
    return new ListAdmins(new DrizzleUserRepository(getDb()));
  },
  get changeOwnPassword() {
    return new ChangeOwnPassword(new DrizzleUserRepository(getDb()), passwordHasher);
  },
  passwordHasher,
  /** 5 login attempts per minute per IP. */
  loginRateLimiter: new RateLimiter({ limit: 5, windowMs: 60_000 }),
  /** 5 password-change attempts per minute per admin: the current password is not an oracle. */
  passwordChangeRateLimiter: new RateLimiter({ limit: 5, windowMs: 60_000 }),
  /** 60 analytics events per minute per IP. */
  eventRateLimiter: new RateLimiter({ limit: 60, windowMs: 60_000 }),

  get recordClientEvent() {
    return new RecordClientEvent(events(), artworks());
  },
  get recordClick() {
    return new RecordClick(events(), trackingLinks());
  },
  get getAnalyticsSummary() {
    return new GetAnalyticsSummary(events());
  },

  findArtwork(id: string) {
    return artworks().findById(id);
  },
  get listArtworks() {
    return new ListArtworks(artworks());
  },
  get createArtwork() {
    return new CreateArtwork(artworks());
  },
  get rerenderArtworkImage() {
    return new RerenderArtworkImage({
      media: mediaAssets(),
      storage: createStorage(),
      images: imageProcessor,
    });
  },
  get updateArtwork() {
    return new UpdateArtwork(
      artworks(),
      new RerenderArtworkImage({
        media: mediaAssets(),
        storage: createStorage(),
        images: imageProcessor,
      }),
    );
  },
  get publishArtwork() {
    return new PublishArtwork(artworks());
  },
  get hideArtwork() {
    return new HideArtwork(artworks());
  },
  get deleteArtwork() {
    return new DeleteArtwork(artworks(), {
      media: mediaAssets(),
      storage: createStorage(),
      video: createVideoPort(),
    });
  },
  get reorderGallery() {
    return new ReorderGallery(artworks());
  },

  get uploadArtworkImage() {
    return new UploadArtworkImage({
      artworks: artworks(),
      media: mediaAssets(),
      storage: createStorage(),
      images: imageProcessor,
      keyPrefix: STORAGE_KEY_PREFIX,
    });
  },
  get startTimelapseUpload() {
    return new StartTimelapseUpload({
      artworks: artworks(),
      media: mediaAssets(),
      video: requireVideoPort(),
    });
  },
  /** Null when Bunny Stream is not configured: nothing to sync. */
  get syncVideoStatus() {
    const video = createVideoPort();
    return video && new SyncVideoStatus(mediaAssets(), video);
  },
  /** Null when Bunny Stream is not configured: no thumbnails to turn into covers. */
  get ensureTimelapseCovers() {
    const video = createVideoPort();
    return (
      video &&
      new EnsureTimelapseCovers(
        mediaAssets(),
        video,
        new UploadArtworkImage({
          artworks: artworks(),
          media: mediaAssets(),
          storage: createStorage(),
          images: imageProcessor,
          keyPrefix: STORAGE_KEY_PREFIX,
        }),
      )
    );
  },
  get listArtworkVideos() {
    return new ListArtworkVideos(mediaAssets(), createVideoPort());
  },
  get listArtworkImages() {
    return new ListArtworkImages(mediaAssets(), createUrlSigner());
  },

  get listPublicGallery() {
    return new ListPublicGallery(publicDeps());
  },
  get countPublicGallery() {
    return new CountPublicGallery(artworks());
  },
  get listPublicTags() {
    return new ListPublicTags(artworks());
  },
  get getPublicArtwork() {
    return new GetPublicArtwork(publicDeps());
  },
  get resolvePublicMedia() {
    return new ResolvePublicMedia(publicDeps());
  },
  get listPublicTiers() {
    return new ListPublicTiers(tiers(), trackingLinks());
  },

  get getSiteSettings() {
    return new GetSiteSettings(siteSettings());
  },
  get updateSiteSettings() {
    return new UpdateSiteSettings(siteSettings());
  },

  get listTiers() {
    return new ListTiers(tiers());
  },
  get createTier() {
    return new CreateTier(tiers(), trackingLinks());
  },
  get updateTier() {
    return new UpdateTier(tiers(), trackingLinks());
  },
  get deleteTier() {
    return new DeleteTier(tiers());
  },
  get listTrackingLinks() {
    return new ListTrackingLinks(trackingLinks());
  },
  get createTrackingLink() {
    return new CreateTrackingLink(trackingLinks(), tiers());
  },
  get updateTrackingLink() {
    return new UpdateTrackingLink(trackingLinks(), tiers());
  },
  get deleteTrackingLink() {
    return new DeleteTrackingLink(trackingLinks());
  },

  get patreon() {
    return patreon();
  },
};
