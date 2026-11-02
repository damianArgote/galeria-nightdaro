import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parsePledgeWebhook,
  parsePostWebhook,
  verifyPatreonSignature,
  webhookKey,
} from "./patreon-webhook";

const secret = "webhook-secret";
const sign = (body: string, key = secret) => createHmac("md5", key).update(body).digest("hex");

const body = JSON.stringify({
  data: {
    id: "m1",
    type: "member",
    attributes: {
      patron_status: "active_patron",
      currently_entitled_amount_cents: 1000,
      pledge_relationship_start: "2026-11-01T10:00:00.000+00:00",
      full_name: "A Fan",
      email: "fan@example.com",
    },
    relationships: { currently_entitled_tiers: { data: [{ id: "pt-10", type: "tier" }] } },
  },
  included: [],
});

describe("verifyPatreonSignature (HMAC-MD5 hex of the raw body)", () => {
  it("accepts the right signature, in either case", () => {
    expect(verifyPatreonSignature(body, sign(body), secret)).toBe(true);
    expect(verifyPatreonSignature(body, sign(body).toUpperCase(), secret)).toBe(true);
  });

  it("rejects a missing, malformed or wrong signature and a changed body", () => {
    expect(verifyPatreonSignature(body, null, secret)).toBe(false);
    expect(verifyPatreonSignature(body, "zz", secret)).toBe(false);
    expect(verifyPatreonSignature(body, sign(body, "other"), secret)).toBe(false);
    expect(verifyPatreonSignature(`${body} `, sign(body), secret)).toBe(false);
  });
});

describe("parsePledgeWebhook", () => {
  it("keeps the member state and drops the fan's name and email", () => {
    const member = parsePledgeWebhook(body);
    expect(member).toEqual({
      id: "m1",
      status: "active_patron",
      amountCents: 1000,
      tierIds: ["pt-10"],
      pledgeStart: new Date("2026-11-01T10:00:00Z"),
    });
    expect(JSON.stringify(member)).not.toMatch(/Fan|fan@/);
  });

  it("rejects a payload that is not a member", () => {
    expect(() => parsePledgeWebhook("not json")).toThrow();
    expect(() => parsePledgeWebhook(JSON.stringify({ data: { type: "post" } }))).toThrow();
  });
});

describe("webhookKey", () => {
  it("is the same for a retried delivery and differs by trigger or body", () => {
    const expected = createHash("sha256").update(`members:pledge:create\n${body}`).digest("hex");
    expect(webhookKey("members:pledge:create", body)).toBe(expected);
    expect(webhookKey("members:pledge:delete", body)).not.toBe(expected);
  });
});

describe("parsePostWebhook", () => {
  it("takes only the post id", () => {
    expect(
      parsePostWebhook(JSON.stringify({ data: { id: "123456", type: "post", attributes: {} } })),
    ).toBe("123456");
    expect(() =>
      parsePostWebhook(JSON.stringify({ data: { id: "m1", type: "member" } })),
    ).toThrow();
    expect(() =>
      parsePostWebhook(JSON.stringify({ data: { id: "../../x", type: "post" } })),
    ).toThrow();
  });
});
