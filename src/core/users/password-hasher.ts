export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /**
   * Checks a password against a stored hash. With a null hash it must still spend comparable
   * time and return false, so unknown emails cannot be told apart by response time.
   */
  verify(password: string, passwordHash: string | null): Promise<boolean>;
}
