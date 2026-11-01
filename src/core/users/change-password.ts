import { z } from "zod";
import { ConflictError, NotFoundError } from "../shared/errors";
import { MAX_PASSWORD_LENGTH } from "./authenticate-admin";
import type { PasswordHasher } from "./password-hasher";
import type { UserRepository } from "./user-repository";

export const MIN_PASSWORD_LENGTH = 12;

export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Al menos ${MIN_PASSWORD_LENGTH} caracteres`)
  .max(MAX_PASSWORD_LENGTH, "Demasiado larga");

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Escribí tu contraseña actual").max(MAX_PASSWORD_LENGTH),
  newPassword: newPasswordSchema,
});
export type ChangeOwnPasswordInput = z.input<typeof changeOwnPasswordSchema>;

/**
 * The signed-in admin picks their own password (always the case after a temporary one). Every
 * session of theirs ends, this one included: they log in again with the new password.
 */
export class ChangeOwnPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(userId: string, input: ChangeOwnPasswordInput): Promise<void> {
    const { currentPassword, newPassword } = changeOwnPasswordSchema.parse(input);
    const user = await this.users.findById(userId);
    if (!user || user.disabledAt) throw new NotFoundError("User", userId);
    if (!(await this.hasher.verify(currentPassword, user.passwordHash))) {
      throw new ConflictError("La contraseña actual no es correcta", "currentPassword");
    }
    if (newPassword === currentPassword) {
      throw new ConflictError("Elegí una contraseña distinta de la actual", "newPassword");
    }
    await this.users.save({
      ...user,
      passwordHash: await this.hasher.hash(newPassword),
      mustChangePassword: false,
      sessionVersion: user.sessionVersion + 1,
    });
  }
}
