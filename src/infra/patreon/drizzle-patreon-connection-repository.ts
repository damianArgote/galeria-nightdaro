import { eq } from "drizzle-orm";
import type { PatreonConnection } from "@/core/patreon/patreon";
import type { PatreonConnectionRepository } from "@/core/patreon/ports";
import type { Db } from "@/db/client";
import { patreonConnection } from "@/db/schema";
import type { TokenCipher } from "./token-cipher";

const ROW = 1;

/** Encrypts tokens and the webhook secret on the way in, decrypts them on the way out. */
export class DrizzlePatreonConnectionRepository implements PatreonConnectionRepository {
  constructor(
    private readonly db: Db,
    private readonly cipher: TokenCipher,
  ) {}

  async get(): Promise<PatreonConnection | null> {
    const [row] = await this.db
      .select()
      .from(patreonConnection)
      .where(eq(patreonConnection.id, ROW));
    if (!row) return null;
    return {
      campaignId: row.campaignId,
      campaignUrl: row.campaignUrl,
      tokens: {
        accessToken: this.cipher.decrypt(row.accessToken),
        refreshToken: this.cipher.decrypt(row.refreshToken),
        expiresAt: row.expiresAt,
      },
      webhook:
        row.webhookId && row.webhookSecret
          ? { id: row.webhookId, secret: this.cipher.decrypt(row.webhookSecret) }
          : null,
      connectedAt: row.connectedAt,
    };
  }

  async save(connection: PatreonConnection): Promise<void> {
    const values = {
      id: ROW,
      campaignId: connection.campaignId,
      campaignUrl: connection.campaignUrl,
      accessToken: this.cipher.encrypt(connection.tokens.accessToken),
      refreshToken: this.cipher.encrypt(connection.tokens.refreshToken),
      expiresAt: connection.tokens.expiresAt,
      webhookId: connection.webhook?.id ?? null,
      webhookSecret: connection.webhook ? this.cipher.encrypt(connection.webhook.secret) : null,
      connectedAt: connection.connectedAt,
    };
    await this.db
      .insert(patreonConnection)
      .values(values)
      .onConflictDoUpdate({ target: patreonConnection.id, set: values });
  }

  async delete(): Promise<void> {
    await this.db.delete(patreonConnection).where(eq(patreonConnection.id, ROW));
  }
}
