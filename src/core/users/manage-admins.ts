import { z } from "zod";
import { systemClock, type Clock } from "../shared/clock";
import { ConflictError, NotFoundError } from "../shared/errors";
import type { PasswordHasher } from "./password-hasher";
import { normalizeUsername, USERNAME_PATTERN, type AdminRole } from "./user";
import type { UserRepository } from "./user-repository";

/** Lowercase letters and digits without look-alikes (no l, 1, o, 0, i), in 4 groups of 4. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const TEMPORARY_PASSWORD_PATTERN = /^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/;

/** About 79 bits of randomness; meant to be read out and typed once. */
export function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .regex(USERNAME_PATTERN, "Entre 3 y 32 letras minúsculas, números, puntos, guiones o _"),
  );

export const createAdminSchema = z.object({ username: usernameSchema });
export type CreateAdminInput = z.input<typeof createAdminSchema>;

export const adminIdSchema = z.object({ id: z.uuid() });
export const setAdminActiveSchema = adminIdSchema.extend({ active: z.boolean() });

export interface CreatedAdmin {
  id: string;
  username: string;
  /** Shown once to the owner, never stored in clear nor shown again. */
  temporaryPassword: string;
}

/** The owner adds an admin, who must replace the temporary password on first login. */
export class CreateAdmin {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(input: CreateAdminInput): Promise<CreatedAdmin> {
    const { username } = createAdminSchema.parse(input);
    if (await this.users.findByUsername(username)) {
      throw new ConflictError(`Ya existe un admin "${username}"`, "username");
    }
    const password = temporaryPassword();
    const id = this.newId();
    await this.users.save({
      id,
      username,
      email: null,
      passwordHash: await this.hasher.hash(password),
      role: "admin",
      mustChangePassword: true,
      disabledAt: null,
      sessionVersion: 0,
    });
    return { id, username, temporaryPassword: password };
  }
}

/** A forgotten password: a new temporary one, and every session of that admin ends. */
export class ResetAdminPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(ownerId: string, input: z.input<typeof adminIdSchema>) {
    const { id } = adminIdSchema.parse(input);
    if (id === ownerId) {
      throw new ConflictError("Para tu propia contraseña usá «Cambiar contraseña».");
    }
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User", id);
    const password = temporaryPassword();
    if (!(await this.users.resetPassword(id, await this.hasher.hash(password)))) {
      throw new NotFoundError("User", id);
    }
    return { username: user.username, temporaryPassword: password };
  }
}

/** Disabling ends the admin's sessions at once; the panel always keeps one active owner. */
export class SetAdminActive {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(ownerId: string, input: z.input<typeof setAdminActiveSchema>): Promise<void> {
    const { id, active } = setAdminActiveSchema.parse(input);
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User", id);
    if (!active) {
      if (id === ownerId) throw new ConflictError("No podés desactivarte a vos mismo.");
      const otherOwners = (await this.users.list()).filter(
        (u) => u.role === "owner" && !u.disabledAt && u.id !== id,
      );
      if (user.role === "owner" && otherOwners.length === 0) {
        throw new ConflictError("Tiene que quedar al menos un dueño activo.");
      }
    }
    await this.users.setDisabled(id, active ? null : this.clock());
  }
}

export interface AdminSummary {
  id: string;
  username: string;
  role: AdminRole;
  /** temporary: has not replaced the temporary password yet. */
  status: "active" | "temporary" | "disabled";
}

export class ListAdmins {
  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<AdminSummary[]> {
    return (await this.users.list()).map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.disabledAt ? "disabled" : user.mustChangePassword ? "temporary" : "active",
    }));
  }
}
