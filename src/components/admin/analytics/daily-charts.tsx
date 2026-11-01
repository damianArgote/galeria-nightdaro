"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Validated with the dataviz palette checker on the panel card (#1c1440): both pass.
const SERIES = {
  visits: { label: "Visitas", color: "#b14dff" },
  clicks: { label: "Clics a tiers y links", color: "#1494c2" },
} as const;

type Day = { day: string; visits: number; clicks: number };

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

function DayTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
  series: keyof typeof SERIES;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-md border border-black bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[3px_3px_0_#000]">
      <p className="font-mono text-muted-foreground">{shortDay(label)}</p>
      <p className="mt-1 flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 rounded-sm"
          style={{ background: SERIES[series].color }}
        />
        {SERIES[series].label}: <b className="tabular-nums">{payload[0]!.value ?? 0}</b>
      </p>
    </div>
  );
}

/**
 * Visits and clicks per day as two small charts sharing the x axis (different scales never share
 * one chart with two y axes).
 */
export function DailyCharts({ daily }: { daily: Day[] }) {
  return (
    <div className="grid gap-5">
      {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((series) => (
        <figure key={series} className="m-0">
          <figcaption className="mb-1 text-sm font-bold">{SERIES[series].label} por día</figcaption>
          <div className="h-[150px]" data-testid={`chart-${series}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={daily}
                margin={{ top: 6, right: 4, bottom: 0, left: -18 }}
                barCategoryGap={2}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="day"
                  tickFormatter={shortDay}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklch, var(--foreground) 8%, transparent)" }}
                  content={<DayTooltip series={series} />}
                />
                <Bar
                  dataKey={series}
                  name={SERIES[series].label}
                  fill={SERIES[series].color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      ))}
    </div>
  );
}
