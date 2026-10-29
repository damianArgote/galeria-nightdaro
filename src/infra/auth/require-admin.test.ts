import { describe, expect, it, vi } from "vitest";
import { createRequireAdmin, UnauthorizedError } from "./require-admin";

describe("requireAdmin", () => {
  it("returns the admin identity when there is a session", async () => {
    const requireAdmin = createRequireAdmin(async () => ({
      user: { id: "u1", email: "daro@example.com" },
    }));

    await expect(requireAdmin()).resolves.toEqual({ id: "u1", email: "daro@example.com" });
  });

  it.each([null, {}, { user: null }, { user: { email: "daro@example.com" } }])(
    "throws UnauthorizedError for session %j",
    async (session) => {
      const requireAdmin = createRequireAdmin(async () => session);
      await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
    },
  );

  it("makes a Server Action fail without a session, before it does any work", async () => {
    const requireAdmin = createRequireAdmin(async () => null);
    const publishArtwork = vi.fn();
    async function publishArtworkAction(id: string) {
      await requireAdmin();
      publishArtwork(id);
    }

    await expect(publishArtworkAction("a1")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(publishArtwork).not.toHaveBeenCalled();
  });
});
