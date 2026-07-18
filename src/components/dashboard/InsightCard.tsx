export function InsightCard({
  n,
  title,
  sub,
  color,
}: {
  n: string;
  title: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3.5 rounded-lg border border-border bg-card p-4">
      <span
        className="shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-bold font-display"
        style={{ color, backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)` }}
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
