import { describe, expect, it, vi } from "vitest";
import type { AdminUser } from "@/core/users/user";
import { createRequireAdmin, MustChangePasswordError, UnauthorizedError } from "./require-admin";

const daro: AdminUser = {
  id: "u1",
  username: "daro",
  email: null,
  passwordHash: "hash",
  role: "owner",
  mustChangePassword: false,
  disabledAt: null,
  sessionVersion: 2,
};
const session = (sessionVersion = 2) => ({ user: { id: "u1", sessionVersion } });
const loader = (user: AdminUser | null) => vi.fn(async () => user);

describe("requireAdmin", () => {
  it("returns the identity when the session matches an active admin", async () => {
    const requireAdmin = createRequireAdmin(async () => session(), loader(daro));
    await expect(requireAdmin()).resolves.toEqual({
      id: "u1",
      username: "daro",
      role: "owner",
      mustChangePassword: false,
      sessionVersion: 2,
    });
  });

  it.each([null, {}, { user: null }, { user: { sessionVersion: 2 } }, { user: { id: "u1" } }])(
    "throws UnauthorizedError for session %j",
    async (value) => {
      const requireAdmin = createRequireAdmin(async () => value, loader(daro));
      await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
    },
  );

  it("ends a still-valid token when the admin was deleted, disabled or their sessions were reset", async () => {
    for (const user of [
      null,
      { ...daro, disabledAt: new Date() },
      { ...daro, sessionVersion: 3 },
    ]) {
      const requireAdmin = createRequireAdmin(async () => session(2), loader(user));
      await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
    }
  });

  it("locks the panel while the password is temporary, except where it is changed", async () => {
    const temporary = { ...daro, mustChangePassword: true };
    const requireAdmin = createRequireAdmin(async () => session(), loader(temporary));
    await expect(requireAdmin()).rejects.toBeInstanceOf(MustChangePasswordError);
    await expect(requireAdmin({ allowTemporaryPassword: true })).resolves.toMatchObject({
      mustChangePassword: true,
    });
  });

  it("only lets the owner through when the owner is required", async () => {
    const asAdmin = createRequireAdmin(async () => session(), loader({ ...daro, role: "admin" }));
    await expect(asAdmin({ role: "owner" })).rejects.toBeInstanceOf(UnauthorizedError);
    const asOwner = createRequireAdmin(async () => session(), loader(daro));
    await expect(asOwner({ role: "owner" })).resolves.toMatchObject({ role: "owner" });
  });

  it("makes a Server Action fail without a session, before it does any work", async () => {
    const requireAdmin = createRequireAdmin(async () => null, loader(daro));
    const publishArtwork = vi.fn();
    async function publishArtworkAction(id: string) {
      await requireAdmin();
      publishArtwork(id);
    }

    await expect(publishArtworkAction("a1")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(publishArtwork).not.toHaveBeenCalled();
  });
});
