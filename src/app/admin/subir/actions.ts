"use server";

import { requireAdmin } from "@/auth";
import { startTimelapseUploadSchema } from "@/core/media/start-timelapse-upload";
import { container } from "@/infra/container";
import { runAction } from "../_lib/run-action";

/**
 * Creates the timelapse draft and returns the signed TUS authorization for this one video; the
 * browser then uploads the file straight to Bunny Stream.
 */
export async function startTimelapseUploadAction(input: unknown) {
  await requireAdmin();
  return runAction(startTimelapseUploadSchema, input, (data) =>
    container.startTimelapseUpload.execute(data),
  );
}
