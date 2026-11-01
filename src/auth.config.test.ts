import { describe, expect, it } from "vitest";
import { authConfig } from "./auth.config";

type Authorized = NonNullable<typeof authConfig.callbacks.authorized>;
const authorized = authConfig.callbacks.authorized as unknown as (
  params: Parameters<Authorized>[0],
) => Response | boolean;

// Behind Render's proxy the request URL is the internal address.
const request = (url: string) =>
  ({ nextUrl: new URL(url) }) as Parameters<Authorized>[0]["request"];

describe("authorized", () => {
  it("sends a visitor without a session to /login with a relative callbackUrl", () => {
    const response = authorized({
      auth: null,
      request: request("https://localhost:10000/admin/links?patreon=conectado"),
    });
    expect(response).toBeInstanceOf(Response);
    const location = new URL((response as Response).headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe("/admin/links?patreon=conectado");
  });

  it("lets admins and public pages through", () => {
    expect(
      authorized({
        auth: { user: { id: "u1" }, expires: "" },
        request: request("https://x/admin"),
      }),
    ).toBe(true);
    expect(authorized({ auth: null, request: request("https://x/apoyar") })).toBe(true);
  });
});
