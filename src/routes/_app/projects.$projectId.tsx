import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarClock,
  CircleSlash,
  ListTodo,
  Pencil,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HealthBadge } from "@/components/projects/HealthBadge";
import { ProgressBar } from "@/components/projects/ProgressBar";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { StatusBadge } from "@/components/activities/StatusBadge";
import { PriorityBadge } from "@/components/activities/PriorityBadge";
import { projectsService } from "@/services/projectsService";
import { useAuth } from "@/providers/AuthProvider";
import { useSound } from "@/providers/SoundProvider";
import { PROJECT_ESTADO_LABEL, type ProjectInput } from "@/lib/types";

export const Route = createFileRoute("/_app/projects/$projectId")({
  head: () => ({
    meta: [{ title: "Proyecto · Nexo" }],
  }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const pk = Number(projectId);
  const { canAccessPlanning } = useAuth();
  const { play } = useSound();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", pk],
    queryFn: () => projectsService.get(pk),
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["project-activities", pk],
    queryFn: () => projectsService.activities(pk),
  });

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const { metrics } = project;

  const handleSubmit = async (values: ProjectInput) => {
    await projectsService.update(pk, values);
    toast.success("Proyecto actualizado");
    play("success");
    qc.invalidateQueries({ queryKey: ["project", pk] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["activities-meta"] });
    setEditing(false);
  };

  const fecha = (iso: string | null) =>
    iso ? format(new Date(iso), "d 'de' MMMM yyyy", { locale: es }) : "Sin definir";

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-2 text-muted-foreground"
        onClick={() => navigate({ to: "/projects" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Proyectos
      </Button>

      <PageHeader
        title={project.nombre}
        description={project.descripcion || "Sin descripción"}
        actions={
          canAccessPlanning && (
            <Button variant="outline" className="gap-2" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{project.id}</span>
        <Badge variant="secondary">{PROJECT_ESTADO_LABEL[project.estado]}</Badge>
        <HealthBadge salud={metrics.salud} />
        {project.cliente && <Badge variant="outline">{project.cliente}</Badge>}
      </div>

      <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Avance</p>
            <p className="text-3xl font-semibold">{metrics.avance}%</p>
          </div>
          {metrics.dias_restantes !== null && (
            <p className="text-sm text-muted-foreground">
              {metrics.dias_restantes >= 0 ? (
                <>
                  Faltan{" "}
                  <span className="font-medium text-foreground">{metrics.dias_restantes}</span> días
                  para la entrega
                </>
              ) : (
                <span style={{ color: "var(--destructive)" }} className="font-medium">
                  {Math.abs(metrics.dias_restantes)} días pasada la fecha de entrega
                </span>
              )}
            </p>
          )}
        </div>

        <ProgressBar metrics={metrics} showLabel={false} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={ListTodo} label="Actividades" value={metrics.total_actividades} />
          <Stat
            icon={ListTodo}
            label="Finalizadas"
            value={metrics.actividades_finalizadas}
            color="var(--status-done)"
          />
          <Stat
            icon={TriangleAlert}
            label="Vencidas"
            value={metrics.actividades_vencidas}
            color={metrics.actividades_vencidas ? "var(--destructive)" : undefined}
          />
          <Stat
            icon={CircleSlash}
            label="Canceladas"
            value={metrics.actividades_canceladas}
            hint="No cuentan para el avance"
          />
        </div>

        <div className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
          <Field icon={UserRound} label="Líder" value={project.lider_nombre || "Sin asignar"} />
          <Field icon={CalendarClock} label="Inicio" value={fecha(project.fecha_inicio)} />
          <Field
            icon={CalendarClock}
            label="Entrega estimada"
            value={fecha(project.fecha_fin_estimada)}
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h3 className="font-semibold">Actividades del proyecto</h3>
            <p className="text-xs text-muted-foreground">
              {/* Las métricas de arriba son del proyecto entero; esta lista
                  muestra solo lo que el rol del usuario alcanza a ver. */}
              Las que puedes ver con tu rol
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/activities" search={{ q: "" }}>
              Ver en Actividades
            </Link>
          </Button>
        </div>

        {loadingActivities ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : activities.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Este proyecto todavía no tiene actividades amarradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Actividad</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Límite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => {
                  const vencida = new Date(a.fechaLimite) < new Date();
                  return (
                    <TableRow key={a.pk}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {a.id}
                      </TableCell>
                      <TableCell className="font-medium">{a.nombre}</TableCell>
                      <TableCell className="text-sm">{a.responsable}</TableCell>
                      <TableCell>
                        <StatusBadge estadoId={a.estado_id} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge prioridadId={a.prioridad_id} />
                      </TableCell>
                      <TableCell
                        className="text-sm"
                        style={vencida ? { color: "var(--destructive)" } : undefined}
                      >
                        {format(new Date(a.fechaLimite), "d MMM yyyy", { locale: es })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar proyecto</DialogTitle>
            <DialogDescription>
              El avance se recalcula solo: depende de las actividades, no de lo que escribas acá.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            defaultValues={project}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
  hint,
}: {
  icon: typeof ListTodo;
  label: string;
  value: number;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold" style={color ? { color } : undefined}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
