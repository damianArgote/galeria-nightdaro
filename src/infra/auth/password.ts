import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 defaults to argon2id (OWASP-recommended parameters).
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
