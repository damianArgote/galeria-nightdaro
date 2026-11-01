/** One measure across a few items: a labelled horizontal bar per row. */
export function BarList({
  rows,
  empty,
  color,
}: {
  rows: { key: string; label: string; detail?: string; value: number }[];
  empty: string;
  color: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="grid gap-2.5">
      {rows.map((row) => (
        <li
          key={row.key}
          className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm"
        >
          <span className="truncate">
            {row.label}
            {row.detail && <span className="text-muted-foreground"> · {row.detail}</span>}
          </span>
          <span className="h-3 overflow-hidden rounded-r-sm bg-border" aria-hidden>
            <span
              className="block h-full rounded-r-[4px]"
              style={{ width: `${(row.value / max) * 100}%`, background: color }}
            />
          </span>
          <b className="text-right tabular-nums">{row.value}</b>
        </li>
      ))}
    </ul>
  );
}
