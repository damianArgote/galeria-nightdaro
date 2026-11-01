import { Panel, PanelHeader } from "@/components/admin/panel";
import { Button } from "@/components/ui/button";
import type { PatreonStatus } from "@/core/patreon/connect";
import { disconnectPatreonAction } from "./actions";

const RESULTS: Record<string, { ok: boolean; message: string }> = {
  conectado: { ok: true, message: "Patreon quedó conectado." },
  cancelado: { ok: false, message: "La conexión se canceló en Patreon." },
  vencido: {
    ok: false,
    message: "La conexión venció o no se inició desde este navegador. Probá de nuevo.",
  },
  error: { ok: false, message: "Patreon no respondió bien. Probá de nuevo en unos minutos." },
  incompleto: {
    ok: false,
    message:
      "Patreon quedó conectado, pero no se pudieron leer sus tiers o crear el aviso de altas. Tocá Conectar Patreon de nuevo para reintentar.",
  },
  "sin-configurar": { ok: false, message: "Falta configurar el cliente de Patreon en Render." },
};

const date = (value: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(value);

/** Connects Daro's campaign (read-only + webhook) or shows the current connection. */
export function PatreonPanel({
  status,
  result,
}: {
  /** Null when PATREON_CLIENT_ID / PATREON_CLIENT_SECRET are not set. */
  status: PatreonStatus | null;
  result?: string;
}) {
  const notice = result ? RESULTS[result] : undefined;
  return (
    <Panel data-testid="patreon-panel">
      <PanelHeader
        title="Patreon"
        description="Acceso de solo lectura a la campaña de Daro: altas, bajas y tiers. Nunca se guardan nombres ni emails de los fans."
      />
      {notice && (
        <p
          role="status"
          className={notice.ok ? "mb-3 text-sm text-brand-green" : "mb-3 text-sm text-destructive"}
        >
          {notice.message}
        </p>
      )}
      {!status ? (
        <p className="text-sm text-muted-foreground">
          Para conectar Patreon hay que registrar el cliente y cargar en Render{" "}
          <code>PATREON_CLIENT_ID</code>, <code>PATREON_CLIENT_SECRET</code> y{" "}
          <code>PATREON_TOKEN_KEY</code> (ver docs/deploy.md).
        </p>
      ) : status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Conectado a{" "}
            <a
              href={status.campaignUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold underline-offset-2 hover:underline"
            >
              {status.campaignUrl.replace(/^https:\/\/(www\.)?/, "")}
            </a>{" "}
            <span className="text-muted-foreground">desde el {date(status.connectedAt)}</span>
          </p>
          <form action={disconnectPatreonAction}>
            <Button type="submit" size="sm" variant="destructive">
              Desconectar
            </Button>
          </form>
        </div>
      ) : (
        <a href="/api/admin/patreon/connect" className="gallery-cta inline-flex px-4 py-2 text-sm">
          Conectar Patreon
        </a>
      )}
    </Panel>
  );
}
