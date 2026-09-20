import type { ProjectMetrics } from "@/lib/types";
import { saludColor } from "./HealthBadge";

/** Barra de avance teñida por la salud del proyecto: el mismo 40% se lee
 *  distinto si va en tiempo o atrasado, y el color lo dice sin leer el
 *  detalle. No usa <Progress> de shadcn porque ese componente fija el
 *  color al `--primary` y acá el color es la información. */
export function ProgressBar({
  metrics,
  showLabel = true,
}: {
  metrics: ProjectMetrics;
  showLabel?: boolean;
}) {
  const color = saludColor(metrics.salud);
  return (
    <div className="space-y-1.5">
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)` }}
        role="progressbar"
        aria-valuenow={metrics.avance}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance del proyecto"
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${metrics.avance}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{metrics.avance}%</span> completado
          </span>
          <span>
            {metrics.actividades_finalizadas} de{" "}
            {metrics.total_actividades - metrics.actividades_canceladas} actividades
          </span>
        </div>
      )}
    </div>
  );
}
