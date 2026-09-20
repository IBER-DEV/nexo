import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FolderKanban } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthBadge } from "@/components/projects/HealthBadge";
import { ProgressBar } from "@/components/projects/ProgressBar";
import { projectsService } from "@/services/projectsService";

/** Banda de proyectos del dashboard: responde "¿cómo van mis proyectos?"
 *  sin salir de la pantalla de inicio. Prioriza los que necesitan
 *  atención — un dashboard que solo muestra lo que va bien no sirve para
 *  decidir nada. */
export function ProjectsPulse() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsService.list(),
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  // Sin proyectos no se muestra nada: el dashboard ya tiene su propio
  // estado vacío y una tarjeta que dice "0 proyectos" es solo ruido. El
  // camino para crear el primero está en /projects.
  if (!projects || projects.length === 0) return null;

  const abiertos = projects.filter((p) => p.estado !== "done" && p.estado !== "cancelled");
  const orden = { atrasado: 0, en_riesgo: 1, sin_fecha: 2, en_tiempo: 3, sin_datos: 4, cerrado: 5 };
  const destacados = [...abiertos]
    .sort(
      (a, b) =>
        orden[a.metrics.salud] - orden[b.metrics.salud] || a.metrics.avance - b.metrics.avance,
    )
    .slice(0, 3);

  if (destacados.length === 0) return null;

  const enProblemas = abiertos.filter(
    (p) => p.metrics.salud === "atrasado" || p.metrics.salud === "en_riesgo",
  ).length;

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <FolderKanban className="h-4 w-4 text-primary" />
            Proyectos
          </h3>
          <p className="text-xs text-muted-foreground">
            {abiertos.length} abierto{abiertos.length === 1 ? "" : "s"}
            {enProblemas > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--destructive)" }} className="font-medium">
                  {enProblemas} requiere{enProblemas === 1 ? "" : "n"} atención
                </span>
              </>
            )}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link to="/projects">
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {destacados.map((p) => (
          <Link
            key={p.pk}
            to="/projects/$projectId"
            params={{ projectId: String(p.pk) }}
            className="group space-y-2 rounded-lg border p-3 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium leading-tight group-hover:text-primary">
                {p.nombre}
              </span>
            </div>
            <HealthBadge salud={p.metrics.salud} />
            <ProgressBar metrics={p.metrics} />
          </Link>
        ))}
      </div>
    </Card>
  );
}
