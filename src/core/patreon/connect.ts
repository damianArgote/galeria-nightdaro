import { ConflictError } from "../shared/errors";
import { systemClock, type Clock } from "../shared/clock";
import { PATREON_SCOPES } from "./patreon";
import type { PatreonConnectionRepository, PatreonPort } from "./ports";

export class PatreonNotConnectedError extends Error {
  constructor() {
    super("Patreon is not connected");
    this.name = "PatreonNotConnectedError";
  }
}

/** Tokens are refreshed when they expire in less than this. */
const REFRESH_MARGIN_MS = 5 * 60_000;

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** Constant-time comparison, so the state check leaks nothing through timing. */
function sameState(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** First leg of OAuth: a random state (kept by the caller in a cookie) and Patreon's URL. */
export class StartPatreonConnect {
  constructor(
    private readonly patreon: PatreonPort,
    private readonly redirectUri: string,
  ) {}

  execute(): { state: string; url: string } {
    const state = randomState();
    const url = this.patreon.authorizeUrl({
      state,
      redirectUri: this.redirectUri,
      scopes: PATREON_SCOPES,
    });
    return { state, url };
  }
}

/**
 * Second leg of OAuth: the state must be the one handed out to this browser (CSRF), then the
 * code becomes tokens and the campaign is stored as the site's single connection.
 */
export class CompletePatreonConnect {
  constructor(
    private readonly patreon: PatreonPort,
    private readonly connections: PatreonConnectionRepository,
    private readonly redirectUri: string,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(input: {
    code: string;
    state: string;
    expectedState: string | undefined;
  }): Promise<void> {
    if (!input.expectedState || !sameState(input.state, input.expectedState)) {
      throw new ConflictError(
        "La conexión con Patreon venció o no la iniciaste vos. Probá de nuevo.",
      );
    }
    const tokens = await this.patreon.exchangeCode({
      code: input.code,
      redirectUri: this.redirectUri,
    });
    const campaign = await this.patreon.getCampaign(tokens.accessToken);
    const previous = await this.connections.get();
    await this.connections.save({
      campaignId: campaign.id,
      campaignUrl: campaign.url,
      tokens,
      // Reconnecting keeps the webhook already registered for the same campaign.
      webhook: previous?.campaignId === campaign.id ? previous.webhook : null,
      connectedAt: this.clock(),
    });
  }
}

/**
 * A valid access token for API calls. Patreon refresh tokens are single use, so concurrent
 * callers share one refresh instead of burning the token twice.
 */
export class PatreonAccess {
  private static inflight: Promise<string> | null = null;

  constructor(
    private readonly patreon: PatreonPort,
    private readonly connections: PatreonConnectionRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async token(): Promise<string> {
    const connection = await this.connections.get();
    if (!connection) throw new PatreonNotConnectedError();
    if (connection.tokens.expiresAt.getTime() - this.clock().getTime() > REFRESH_MARGIN_MS) {
      return connection.tokens.accessToken;
    }
    PatreonAccess.inflight ??= this.refresh(connection.tokens.refreshToken).finally(() => {
      PatreonAccess.inflight = null;
    });
    return PatreonAccess.inflight;
  }

  private async refresh(refreshToken: string): Promise<string> {
    // Another process may have refreshed since our read: its pair is the valid one now.
    const latest = await this.connections.get();
    if (!latest) throw new PatreonNotConnectedError();
    if (latest.tokens.refreshToken !== refreshToken) return latest.tokens.accessToken;

    const tokens = await this.patreon.refresh(refreshToken);
    try {
      await this.connections.save({ ...latest, tokens });
    } catch (error) {
      // The old refresh token is spent and the new one was not stored.
      console.error("Patreon tokens refreshed but not saved: reconnect Patreon from the panel");
      throw error;
    }
    return tokens.accessToken;
  }
}

export class DisconnectPatreon {
  constructor(
    private readonly patreon: PatreonPort,
    private readonly connections: PatreonConnectionRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** Removes the webhook at Patreon when possible; the local connection goes either way. */
  async execute(): Promise<void> {
    const connection = await this.connections.get();
    if (!connection) return;
    if (connection.webhook) {
      try {
        const token = await new PatreonAccess(this.patreon, this.connections, this.clock).token();
        await this.patreon.deleteWebhook(token, connection.webhook.id);
      } catch (error) {
        console.error("Could not delete the Patreon webhook", error);
      }
    }
    await this.connections.delete();
  }
}

export type PatreonStatus =
  { connected: false } | { connected: true; campaignUrl: string; connectedAt: Date };

export class GetPatreonStatus {
  constructor(private readonly connections: PatreonConnectionRepository) {}

  async execute(): Promise<PatreonStatus> {
    const connection = await this.connections.get();
    return connection
      ? {
          connected: true,
          campaignUrl: connection.campaignUrl,
          connectedAt: connection.connectedAt,
        }
      : { connected: false };
  }
}
