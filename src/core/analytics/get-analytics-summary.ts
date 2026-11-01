import { z } from "zod";
import type { AnalyticsSummary, DateRange } from "./analytics-summary";
import type { EventRepository } from "./ports";

const day = z.iso.date();
export const dateRangeSchema = z
  .object({ from: day, to: day })
  .refine(({ from, to }) => from <= to, { error: "La fecha de inicio es posterior al fin" })
  .refine(({ from, to }) => daysBetween(from, to) <= 366, { error: "El rango máximo es un año" });

function daysBetween(from: string, to: string) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

function eachDay({ from, to }: DateRange): string[] {
  const days: string[] = [];
  for (
    let t = Date.parse(`${from}T00:00:00Z`);
    t <= Date.parse(`${to}T00:00:00Z`);
    t += 86_400_000
  ) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

const rate = (part: number, whole: number) => (whole > 0 ? Math.min(part / whole, 1) : 0);

export class GetAnalyticsSummary {
  constructor(private readonly events: EventRepository) {}

  async execute(input: DateRange, topArtworks = 5): Promise<AnalyticsSummary> {
    const range = dateRangeSchema.parse(input);
    const counts = await this.events.summarize(range, topArtworks);

    // Every day of the range, zeros included, so the chart has no gaps.
    const byDay = new Map(counts.daily.map((d) => [d.day, d]));
    const daily = eachDay(range).map((d) => byDay.get(d) ?? { day: d, visits: 0, clicks: 0 });

    return {
      ...counts,
      daily,
      range,
      ageGateRate: rate(counts.ageGateSessions, counts.uniqueVisitors),
      conversion: rate(counts.clickingSessions, counts.uniqueVisitors),
    };
  }
}
