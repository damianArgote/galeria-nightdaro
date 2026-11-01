"use server";

import { requireAdmin } from "@/auth";
import { adminIdSchema, createAdminSchema, setAdminActiveSchema } from "@/core/users/manage-admins";
import { container } from "@/infra/container";
import { runAction } from "../_lib/run-action";

/** Owner only: the temporary password comes back once, to show and pass on. */
export async function createAdminAction(input: unknown) {
  await requireAdmin({ role: "owner" });
  return runAction(createAdminSchema, input, (data) => container.createAdmin.execute(data));
}

export async function resetAdminPasswordAction(input: unknown) {
  const owner = await requireAdmin({ role: "owner" });
  return runAction(adminIdSchema, input, (data) =>
    container.resetAdminPassword.execute(owner.id, data),
  );
}

export async function setAdminActiveAction(input: unknown) {
  const owner = await requireAdmin({ role: "owner" });
  return runAction(setAdminActiveSchema, input, (data) =>
    container.setAdminActive.execute(owner.id, data),
  );
}
