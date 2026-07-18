/**
 * La firma visual del dashboard de Nexo — un banner con degradado de marca,
 * un titular en vivo y un sparkline real (progreso semanal) con un punto que
 * lo recorre, como si el equipo tuviera latido. Del brand kit "Pulso".
 */
export function PulseBand({
  movingCount,
  onTimePct,
  sparkPoints,
}: {
  movingCount: number;
  onTimePct: number | null;
  sparkPoints: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--primary)_28%,var(--border))] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_10%,var(--card)),var(--card))] p-6">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary mb-1.5">
            Actividad en vivo
          </p>
          <h2 className="text-2xl font-semibold font-display tracking-tight">
            {movingCount} actividad{movingCount === 1 ? "" : "es"} en movimiento hoy
          </h2>
        </div>
        {onTimePct !== null && (
          <div className="text-right shrink-0">
            <p className="text-3xl font-bold font-display tabular-nums leading-none">
              {onTimePct}
              <span className="text-base font-semibold text-muted-foreground">%</span>
            </p>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">A tiempo</p>
          </div>
        )}
      </div>
      <div className="relative h-16">
        <svg
          width="100%"
          height="64"
          viewBox="0 0 800 64"
          preserveAspectRatio="none"
          className="block"
          aria-hidden="true"
        >
          <polyline
            points={sparkPoints}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            opacity="0.85"
          />
        </svg>
        <div className="pulse-dot absolute top-3 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_3px_var(--primary)]" />
      </div>
    </div>
  );
}
