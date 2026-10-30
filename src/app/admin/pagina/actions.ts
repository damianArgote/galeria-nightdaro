"use server";

import { requireAdmin } from "@/auth";
import { updateSiteSettingsSchema } from "@/core/site/update-site-settings";
import { container } from "@/infra/container";
import { runAction } from "../_lib/run-action";

export async function updateSiteSettingsAction(input: unknown) {
  await requireAdmin();
  return runAction(updateSiteSettingsSchema, input, async (data) => {
    await container.updateSiteSettings.execute(data);
    return undefined;
  });
}
