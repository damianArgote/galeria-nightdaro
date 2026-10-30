// Composition root: wires core use cases to their infra adapters.
import "server-only";
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
  GetPublicArtwork,
  ListPublicGallery,
  ResolvePublicMedia,
} from "@/core/gallery/public-gallery";
import { ListPublicTiers } from "@/core/gallery/public-tiers";
import { ListArtworkImages } from "@/core/media/list-artwork-images";
import { ListArtworkVideos } from "@/core/media/list-artwork-videos";
import { RerenderArtworkImage } from "@/core/media/rerender-artwork-image";
import { StartTimelapseUpload } from "@/core/media/start-timelapse-upload";
import { SyncVideoStatus } from "@/core/media/sync-video-status";
import { UploadArtworkImage } from "@/core/media/upload-artwork-image";
import { InvalidInputError } from "@/core/shared/errors";
import { GetSiteSettings } from "@/core/site/get-site-settings";
import { UpdateSiteSettings } from "@/core/site/update-site-settings";
import { AuthenticateAdmin } from "@/core/users/authenticate-admin";
import { createDb, type Db } from "@/db/client";
import { requireEnv } from "@/db/env";
import { DrizzleArtworkRepository } from "./artworks/drizzle-artwork-repository";
import { Argon2PasswordHasher } from "./auth/argon2-password-hasher";
import { RateLimiter } from "./auth/rate-limiter";
import {
  DrizzleTierRepository,
  DrizzleTrackingLinkRepository,
} from "./links/drizzle-link-repositories";
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
  get authenticateAdmin() {
    return new AuthenticateAdmin(new DrizzleUserRepository(getDb()), passwordHasher);
  },
  passwordHasher,
  /** 5 login attempts per minute per IP. */
  loginRateLimiter: new RateLimiter({ limit: 5, windowMs: 60_000 }),

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
  get listArtworkVideos() {
    return new ListArtworkVideos(mediaAssets(), createVideoPort());
  },
  get listArtworkImages() {
    return new ListArtworkImages(mediaAssets(), createUrlSigner());
  },

  get listPublicGallery() {
    return new ListPublicGallery(publicDeps());
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
  async findTrackingLink(code: string) {
    return trackingLinks().findByCode(code);
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
};
