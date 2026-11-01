"use server";

import { requireAdmin, signOut } from "@/auth";
import { changeOwnPasswordSchema } from "@/core/users/change-password";
import { container } from "@/infra/container";
import { runAction } from "../admin/_lib/run-action";

/** The only action open with a temporary password. */
export async function changePasswordAction(input: unknown) {
  const admin = await requireAdmin({ allowTemporaryPassword: true });
  return runAction(changeOwnPasswordSchema, input, (data) =>
    container.changeOwnPassword.execute(admin.id, data),
  );
}

/** After the change every session ended, this one too: clear the cookie and log in again. */
export async function finishPasswordChange() {
  await signOut({ redirectTo: "/login?aviso=clave-cambiada" });
}
