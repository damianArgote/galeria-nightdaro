import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { VideoPort, VideoStatus, VideoUploadAuthorization } from "@/core/media/ports";

const API = "https://video.bunnycdn.com";
const TUS_ENDPOINT = `${API}/tusupload`;
const PLAYER = "https://iframe.mediadelivery.net/embed";

/** Bunny Stream `status`: 0 created … 3 transcoding, 4 finished, 5 error, 6 upload failed. */
function toVideoStatus(status: number): VideoStatus {
  if (status === 4) return "ready";
  if (status === 5 || status === 6) return "failed";
  return "processing";
}

/** TUS upload signature: sha256(library_id + api_key + expiration_time + video_id), hex. */
export function tusSignature(libraryId: string, apiKey: string, expires: number, videoId: string) {
  return createHash("sha256").update(`${libraryId}${apiKey}${expires}${videoId}`).digest("hex");
}

/** Embed view token: sha256_hex(token_security_key + video_id + expiration). */
export function embedToken(tokenKey: string, videoId: string, expires: number) {
  return createHash("sha256").update(`${tokenKey}${videoId}${expires}`).digest("hex");
}

/** Webhook signature v1: hex HMAC-SHA256 of the raw body with the library's read-only key. */
export function verifyStreamWebhook(
  rawBody: string,
  signature: string | null,
  readOnlyKey: string,
) {
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", readOnlyKey).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export class BunnyStreamAdapter implements VideoPort {
  constructor(
    private readonly config: {
      libraryId: string;
      apiKey: string;
      /** Embed view token authentication key of the library. */
      tokenKey: string;
      fetch?: typeof fetch;
    },
  ) {}

  async createVideo(title: string): Promise<{ videoId: string }> {
    const response = await this.request("POST", "", { title });
    if (!response.ok) throw new Error(`Bunny Stream create video failed with ${response.status}`);
    const body = (await response.json()) as { guid?: string };
    if (!body.guid) throw new Error("Bunny Stream did not return a video id");
    return { videoId: body.guid };
  }

  authorizeUpload(videoId: string, expiresAt: Date): VideoUploadAuthorization {
    const expires = Math.floor(expiresAt.getTime() / 1000);
    const { libraryId, apiKey } = this.config;
    return {
      endpoint: TUS_ENDPOINT,
      videoId,
      libraryId,
      expires,
      signature: tusSignature(libraryId, apiKey, expires, videoId),
    };
  }

  async getStatus(videoId: string): Promise<VideoStatus> {
    const response = await this.request("GET", `/${encodeURIComponent(videoId)}`);
    if (response.status === 404) return "failed";
    if (!response.ok) throw new Error(`Bunny Stream get video failed with ${response.status}`);
    const body = (await response.json()) as { status?: number };
    return toVideoStatus(body.status ?? 0);
  }

  playerUrl(videoId: string, expiresAt: Date): string {
    const expires = Math.floor(expiresAt.getTime() / 1000);
    const token = embedToken(this.config.tokenKey, videoId, expires);
    return `${PLAYER}/${this.config.libraryId}/${videoId}?token=${token}&expires=${expires}`;
  }

  async deleteVideo(videoId: string): Promise<void> {
    const response = await this.request("DELETE", `/${encodeURIComponent(videoId)}`);
    if (!response.ok && response.status !== 404) {
      throw new Error(`Bunny Stream delete video failed with ${response.status}`);
    }
  }

  private request(method: string, path: string, body?: unknown) {
    const url = `${API}/library/${encodeURIComponent(this.config.libraryId)}/videos${path}`;
    return (this.config.fetch ?? fetch)(url, {
      method,
      headers: {
        AccessKey: this.config.apiKey,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}
