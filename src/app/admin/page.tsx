import Link from "next/link";
import { requireAdmin } from "@/auth";
import { dateRangeSchema } from "@/core/analytics/get-analytics-summary";
import { BarList } from "@/components/admin/analytics/bar-list";
import { DailyCharts } from "@/components/admin/analytics/daily-charts";
import { Panel, PanelHeader, ViewHeader } from "@/components/admin/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { container } from "@/infra/container";
import { ANALYTICS_TIME_ZONE } from "@/infra/analytics/drizzle-event-repository";
import { cn } from "@/lib/utils";

const PRESETS = [7, 14, 30] as const;
const PLATFORM_NAMES: Record<string, string> = {
  patreon: "Patreon",
  onlyfans: "OnlyFans",
  fansly: "Fansly",
};

/** YYYY-MM-DD of today in the analytics time zone, shifted by `days`. */
function dayInZone(days = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ANALYTICS_TIME_ZONE }).format(
    new Date(),
  );
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const percent = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("es-AR").format(value);

function Stat({
  label,
  kanji,
  value,
  detail,
}: {
  label: string;
  kanji: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-md border-[3px] border-black bg-card p-4 shadow-[5px_5px_0_#000]">
      <p className="flex justify-between gap-2 text-sm font-bold text-muted-foreground">
        {label}
        <span aria-hidden className="text-foreground/55">
          {kanji}
        </span>
      </p>
      <p className="mt-2 text-3xl font-black tabular-nums" data-testid={`stat-${label}`}>
        {value}
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const parsed = dateRangeSchema.safeParse({
    from: params.desde ?? dayInZone(-13),
    to: params.hasta ?? dayInZone(),
  });
  const range = parsed.success ? parsed.data : { from: dayInZone(-13), to: dayInZone() };
  const summary = await container.getAnalyticsSummary.execute(range);
  const days =
    (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000 + 1;

  return (
    <>
      <ViewHeader
        kanji="概要"
        eyebrow={`Últimos ${days} días`}
        title="Resumen"
        description="Cuánta gente pasa por la galería y cuántos llegan a un tier. Sin IPs ni servicios externos."
      />

      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3"
        aria-label="Filtrar por fechas"
      >
        <nav aria-label="Rangos rápidos" className="flex gap-1.5">
          {PRESETS.map((preset) => {
            const href = `/admin?desde=${dayInZone(1 - preset)}&hasta=${dayInZone()}`;
            const active = range.to === dayInZone() && days === preset;
            return (
              <Link
                key={preset}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-sm border-2 border-border px-3 py-1.5 text-sm font-bold",
                  active && "bg-foreground text-background",
                )}
              >
                {preset} días
              </Link>
            );
          })}
        </nav>
        <label className="grid gap-1 text-xs font-bold">
          Desde
          <Input type="date" name="desde" defaultValue={range.from} className="w-40" />
        </label>
        <label className="grid gap-1 text-xs font-bold">
          Hasta
          <Input type="date" name="hasta" defaultValue={range.to} className="w-40" />
        </label>
        <Button type="submit" variant="outline">
          Aplicar
        </Button>
        {!parsed.success && (
          <p role="alert" className="w-full text-sm text-destructive">
            {parsed.error.issues[0]?.message ?? "Rango inválido"}; se muestran los últimos 14 días.
          </p>
        )}
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Visitas" kanji="訪問" value={number(summary.visits)} detail="páginas vistas" />
        <Stat
          label="Visitantes únicos"
          kanji="人"
          value={number(summary.uniqueVisitors)}
          detail="sesiones distintas por día"
        />
        <Stat
          label="Pasaron la puerta +18"
          kanji="十八"
          value={percent(summary.ageGateRate)}
          detail={`${number(summary.ageGateSessions)} de ${number(summary.uniqueVisitors)} visitantes`}
        />
        <Stat
          label="Conversión a clic"
          kanji="率"
          value={percent(summary.conversion)}
          detail={`${number(summary.clicks)} clics de ${number(summary.clickingSessions)} visitantes`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Visitas y clics por día" description="Hora de Buenos Aires." />
          <DailyCharts daily={summary.daily} />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Ver como tabla</summary>
            <table className="mt-2 w-full text-left tabular-nums">
              <thead className="font-mono text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-1">Día</th>
                  <th className="py-1 text-right">Visitas</th>
                  <th className="py-1 text-right">Clics</th>
                </tr>
              </thead>
              <tbody>
                {summary.daily.map((d) => (
                  <tr key={d.day} className="border-t border-border">
                    <td className="py-1">{d.day}</td>
                    <td className="py-1 text-right">{d.visits}</td>
                    <td className="py-1 text-right">{d.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Panel>

        <div className="grid content-start gap-6">
          <Panel>
            <PanelHeader title="Clics por tier" />
            <div data-testid="clicks-by-tier">
              <BarList
                color="#1494c2"
                empty="Todavía no hay clics en tiers."
                rows={summary.clicksByTier.map((t) => ({
                  key: t.tierId,
                  label: t.name,
                  detail: PLATFORM_NAMES[t.platform] ?? t.platform,
                  value: t.clicks,
                }))}
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Clics por red" description="Links de seguimiento sin tier." />
            <BarList
              color="#1494c2"
              empty="Todavía no hay clics en links de redes."
              rows={summary.clicksByLink.map((l) => ({
                key: l.linkId,
                label: l.label,
                value: l.clicks,
              }))}
            />
          </Panel>
        </div>
      </div>

      <Panel className="mt-6">
        <PanelHeader
          title="Obras más vistas"
          description="Vistas en el lightbox o en la ficha de la obra."
        />
        {summary.topArtworks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay vistas de obras.</p>
        ) : (
          <table className="w-full text-left text-sm" data-testid="top-artworks">
            <thead className="font-mono text-xs text-muted-foreground uppercase">
              <tr>
                <th className="pb-2">Obra</th>
                <th className="pb-2 text-right">Vistas</th>
              </tr>
            </thead>
            <tbody>
              {summary.topArtworks.map((a) => (
                <tr key={a.artworkId} className="border-t border-border">
                  <td className="py-2">
                    <a
                      href={`/obra/${a.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {a.title}
                    </a>
                  </td>
                  <td className="py-2 text-right tabular-nums">{a.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
