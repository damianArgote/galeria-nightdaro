import type { VideoPort, VideoStatus, VideoUploadAuthorization } from "@/core/media/ports";

/** In-memory VideoPort for tests: set `statuses` to simulate the service finishing encoding. */
export class FakeVideoPort implements VideoPort {
  readonly statuses = new Map<string, VideoStatus>();
  readonly deleted: string[] = [];
  failCreate = false;
  private next = 1;

  async createVideo(): Promise<{ videoId: string }> {
    if (this.failCreate) throw new Error("video service down");
    const videoId = `video-${this.next++}`;
    this.statuses.set(videoId, "processing");
    return { videoId };
  }

  authorizeUpload(videoId: string, expiresAt: Date): VideoUploadAuthorization {
    const expires = Math.floor(expiresAt.getTime() / 1000);
    return {
      endpoint: "https://fake/tus",
      videoId,
      libraryId: "lib",
      expires,
      signature: `sig-${videoId}-${expires}`,
    };
  }

  async getStatus(videoId: string): Promise<VideoStatus> {
    return this.statuses.get(videoId) ?? "failed";
  }

  playerUrl(videoId: string, expiresAt: Date): string {
    return `https://player/${videoId}?expires=${Math.floor(expiresAt.getTime() / 1000)}`;
  }

  async deleteVideo(videoId: string): Promise<void> {
    this.deleted.push(videoId);
    this.statuses.delete(videoId);
  }
}
