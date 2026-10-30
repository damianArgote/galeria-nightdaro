"use server";

import { requireAdmin } from "@/auth";
import { createTierSchema } from "@/core/links/create-tier";
import { createTrackingLinkSchema } from "@/core/links/create-tracking-link";
import { deleteTierSchema } from "@/core/links/delete-tier";
import { deleteTrackingLinkSchema } from "@/core/links/delete-tracking-link";
import { updateTierSchema } from "@/core/links/update-tier";
import { updateTrackingLinkSchema } from "@/core/links/update-tracking-link";
import { container } from "@/infra/container";
import { runAction } from "../_lib/run-action";

export async function createTierAction(input: unknown) {
  await requireAdmin();
  return runAction(createTierSchema, input, async (data) => {
    await container.createTier.execute(data);
    return undefined;
  });
}

export async function updateTierAction(input: unknown) {
  await requireAdmin();
  return runAction(updateTierSchema, input, async (data) => {
    await container.updateTier.execute(data);
    return undefined;
  });
}

export async function deleteTierAction(input: unknown) {
  await requireAdmin();
  return runAction(deleteTierSchema, input, (data) => container.deleteTier.execute(data));
}

export async function createTrackingLinkAction(input: unknown) {
  await requireAdmin();
  return runAction(createTrackingLinkSchema, input, async (data) => {
    await container.createTrackingLink.execute(data);
    return undefined;
  });
}

export async function updateTrackingLinkAction(input: unknown) {
  await requireAdmin();
  return runAction(updateTrackingLinkSchema, input, async (data) => {
    await container.updateTrackingLink.execute(data);
    return undefined;
  });
}

export async function deleteTrackingLinkAction(input: unknown) {
  await requireAdmin();
  return runAction(deleteTrackingLinkSchema, input, (data) =>
    container.deleteTrackingLink.execute(data),
  );
}
