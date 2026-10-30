-- Not backfilled on purpose: images uploaded before ratings re-rendered may not match their
-- artwork's current rating. NULL counts as stale, so the admin gallery renders them again from
-- the private original before any of them is signed.
ALTER TABLE "media_assets" ADD COLUMN "rendered_rating" "artwork_rating";
