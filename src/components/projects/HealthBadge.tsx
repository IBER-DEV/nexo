import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SALUD_LABEL, type ProjectSalud } from "@/lib/types";

/** Color de cada semáforo, como token de la paleta de marca — no hex
 *  sueltos: los tokens ya están pensados para claro y oscuro
 *  (ver src/styles.css). */
const SALUD_STYLE: Record<ProjectSalud, { color: string; icon: typeof Clock }> = {
  en_tiempo: { color: "var(--status-done)", icon: CheckCircle2 },
  en_riesgo: { color: "var(--status-testing)", icon: AlertTriangle },
  atrasado: { color: "var(--destructive)", icon: Flag },
  sin_fecha: { color: "var(--status-pending)", icon: Clock },
  sin_datos: { color: "var(--status-backlog)", icon: CircleDashed },
  cerrado: { color: "var(--status-cancelled)", icon: CheckCircle2 },
};

export function HealthBadge({ salud, className }: { salud: ProjectSalud; className?: string }) {
  const { color, icon: Icon } = SALUD_STYLE[salud] ?? SALUD_STYLE.sin_datos;
  return (
    <Badge
      variant="outline"
      className={`gap-1 font-medium border ${className ?? ""}`}
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 30%, transparent)`,
      }}
    >
      <Icon className="h-3 w-3" />
      {SALUD_LABEL[salud] ?? salud}
    </Badge>
  );
}

export function saludColor(salud: ProjectSalud): string {
  return (SALUD_STYLE[salud] ?? SALUD_STYLE.sin_datos).color;
}
