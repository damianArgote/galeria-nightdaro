"use client";

import { useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/core/users/change-password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, finishPasswordChange } from "./actions";

type Errors = Partial<Record<"currentPassword" | "newPassword" | "confirm", string>>;

export function ChangePasswordForm({ temporary }: { temporary: boolean }) {
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  // onSubmit, not a form action: React empties a form after its action, and a rejected new
  // password must not wipe the temporary one the admin already typed.
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirm") ?? "")) {
      setErrors({ confirm: "Las dos contraseñas nuevas no coinciden" });
      return;
    }
    setPending(true);
    setErrors({});
    setMessage(undefined);
    const result = await changePasswordAction({ currentPassword, newPassword });
    if (result.ok) {
      await finishPasswordChange();
      return;
    }
    setPending(false);
    setMessage(result.error);
    setErrors({
      currentPassword: result.fieldErrors?.currentPassword?.[0],
      newPassword: result.fieldErrors?.newPassword?.[0],
    });
  }

  const field = (id: keyof Errors, label: string, autoComplete: string, hint?: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={!!errors[id]}
        aria-describedby={hint ? `${id}-hint` : undefined}
        required
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errors[id] && <p className="text-sm text-destructive">{errors[id]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {field(
        "currentPassword",
        temporary ? "Contraseña temporal" : "Contraseña actual",
        "current-password",
      )}
      {field(
        "newPassword",
        "Contraseña nueva",
        "new-password",
        `Al menos ${MIN_PASSWORD_LENGTH} caracteres. Una frase de varias palabras es fácil de recordar.`,
      )}
      {field("confirm", "Repetí la contraseña nueva", "new-password")}
      {message && !errors.currentPassword && !errors.newPassword && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar y volver a entrar"}
      </Button>
    </form>
  );
}
