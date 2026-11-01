import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";
const TAG_LENGTH = 16;
const b64 = (data: Buffer) => data.toString("base64url");

/**
 * AES-256-GCM for the Patreon tokens and webhook secret at rest. The key is derived with HKDF
 * from PATREON_TOKEN_KEY, so any long random string works (Render's generateValue included).
 * Format: v1.<iv>.<auth tag>.<ciphertext>, all base64url.
 */
export class TokenCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (secret.length < 16) throw new Error("PATREON_TOKEN_KEY must be at least 16 characters");
    this.key = Buffer.from(hkdfSync("sha256", secret, "nightdaro", "patreon-tokens", 32));
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(data)].join(".");
  }

  decrypt(sealed: string): string {
    const [version, iv, tag, data] = sealed.split(".");
    if (version !== VERSION || !iv || !tag || !data) throw new Error("Not a sealed value");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"), {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}
