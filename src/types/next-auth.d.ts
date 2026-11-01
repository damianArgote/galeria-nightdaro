import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  /** What authorize() returns: the admin identity. */
  interface User {
    username?: string;
    sessionVersion?: number;
  }
  interface Session {
    user: { id: string; name?: string | null; sessionVersion?: number };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Session version of the admin when the token was issued. */
    sv?: number;
  }
}
