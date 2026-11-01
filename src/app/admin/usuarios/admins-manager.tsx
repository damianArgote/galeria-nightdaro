"use client";

import { useState, useTransition } from "react";
import type { AdminSummary } from "@/core/users/manage-admins";
import { FormField } from "@/components/admin/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createAdminAction, resetAdminPasswordAction, setAdminActiveAction } from "./actions";

const STATUS: Record<AdminSummary["status"], { label: string; className: string }> = {
  active: { label: "Activo", className: "border-brand-green text-brand-green" },
  temporary: { label: "Contraseña temporal", className: "border-brand-sky text-brand-sky" },
  disabled: { label: "Desactivado", className: "border-destructive text-destructive" },
};

/** Shown once: the owner passes it on through a private channel. */
function TemporaryPassword({
  username,
  password,
  onDone,
}: {
  username: string;
  password: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      role="status"
      data-testid="temporary-password"
      className="mb-5 rounded-sm border-[3px] border-brand-sky bg-background p-4 shadow-[4px_4px_0_#000]"
    >
      <p className="text-sm">
        Contraseña temporal de <b>{username}</b>. Pasásela por un canal privado:{" "}
        <b>no se vuelve a mostrar</b>. Al entrar va a tener que elegir la suya.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-xs border-2 border-border bg-card px-3 py-1.5 font-mono text-lg tracking-wider select-all">
          {password}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard?.writeText(password).catch(() => undefined);
            setCopied(true);
          }}
        >
          {copied ? "Copiada" : "Copiar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Listo
        </Button>
      </div>
    </div>
  );
}

export function AdminsManager({
  admins,
  currentId,
}: {
  admins: AdminSummary[];
  currentId: string;
}) {
  const [username, setUsername] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();
  const [issued, setIssued] = useState<{ username: string; password: string }>();
  const [pending, startTransition] = useTransition();

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldError(undefined);
    startTransition(async () => {
      const result = await createAdminAction({ username });
      if (!result.ok) {
        setFieldError(result.fieldErrors?.username?.[0] ?? result.error);
        return;
      }
      setIssued({ username: result.data.username, password: result.data.temporaryPassword });
      setUsername("");
    });
  }

  function reset(admin: AdminSummary) {
    if (!confirm(`¿Resetear la contraseña de ${admin.username}? Se cierran sus sesiones.`)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await resetAdminPasswordAction({ id: admin.id });
      if (!result.ok) return setError(result.error);
      setIssued({ username: result.data.username, password: result.data.temporaryPassword });
    });
  }

  function setActive(admin: AdminSummary, active: boolean) {
    if (!active && !confirm(`¿Desactivar a ${admin.username}? Se cierran sus sesiones.`)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await setAdminActiveAction({ id: admin.id, active });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      {issued && (
        <TemporaryPassword
          username={issued.username}
          password={issued.password}
          onDone={() => setIssued(undefined)}
        />
      )}

      <form
        onSubmit={create}
        noValidate
        data-tour="users-create"
        className="mb-5 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-56 flex-1">
          <FormField
            id="new-admin-username"
            label="Usuario del admin nuevo"
            hint=" · Minúsculas, números, punto, guion o _."
            error={fieldError}
          >
            <Input
              id="new-admin-username"
              value={username}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={!!fieldError}
              onChange={(event) => setUsername(event.target.value)}
            />
          </FormField>
        </div>
        <Button type="submit" disabled={pending || !username.trim()}>
          Crear admin
        </Button>
      </form>

      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="grid gap-2" data-tour="users-list">
        {admins.map((admin) => {
          const self = admin.id === currentId;
          return (
            <li
              key={admin.id}
              data-testid="admin-row"
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border-2 border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <b>{admin.username}</b>
                <Badge variant="outline">{admin.role === "owner" ? "Dueño" : "Admin"}</Badge>
                <Badge variant="outline" className={cn(STATUS[admin.status].className)}>
                  {STATUS[admin.status].label}
                </Badge>
                {self && <span className="text-xs text-muted-foreground">(vos)</span>}
              </div>
              {!self && (
                <div className="flex flex-wrap gap-1.5">
                  {admin.status !== "disabled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => reset(admin)}
                    >
                      Resetear contraseña
                    </Button>
                  )}
                  {admin.status === "disabled" ? (
                    <Button size="sm" disabled={pending} onClick={() => setActive(admin, true)}>
                      Reactivar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => setActive(admin, false)}
                    >
                      Desactivar
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
