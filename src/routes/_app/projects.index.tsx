import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, FolderKanban, Plus, Target, TrendingUp, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HealthBadge } from "@/components/projects/HealthBadge";
import { ProgressBar } from "@/components/projects/ProgressBar";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { projectsService } from "@/services/projectsService";
import { useAuth } from "@/providers/AuthProvider";
import { useSound } from "@/providers/SoundProvider";
import {
  PROJECT_ESTADO_LABEL,
  SALUD_LABEL,
  type Project,
  type ProjectInput,
  type ProjectSalud,
} from "@/lib/types";

type ProjectsSearch = {
  new?: boolean;
};

export const Route = createFileRoute("/_app/projects/")({
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    new: search.new === true || search.new === "1" || search.new === "true",
  }),
  head: () => ({
    meta: [
      { title: "Proyectos · Nexo" },
      {
        name: "description",
        content: "Estado y avance de los proyectos del equipo, calculado desde sus actividades.",
      },
    ],
  }),
  component: ProjectsPage,
});

const TODOS = "__all__";

/** Orden del semáforo en los filtros y en el resumen: primero lo que
 *  requiere atención. Un gestor abre esta pantalla para encontrar
 *  problemas, no para confirmar que todo va bien. */
const SALUD_ORDEN: ProjectSalud[] = [
  "atrasado",
  "en_riesgo",
  "en_tiempo",
  "sin_fecha",
  "sin_datos",
  "cerrado",
];

function ProjectsPage() {
  const { canAccessPlanning } = useAuth();
  const { play } = useSound();
  const qc = useQueryClient();
  const { new: openNew } = Route.useSearch();

  const [q, setQ] = useState("");
  const [saludFiltro, setSaludFiltro] = useState<string>(TODOS);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  // Deep-link desde el empty state del dashboard: /projects?new=1 abre el
  // formulario de creación directo — mismo patrón que /activities?new=1.
  useEffect(() => {
    if (openNew) setOpenForm(true);
  }, [openNew]);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsService.list(),
  });

  const handleSubmit = async (values: ProjectInput) => {
    if (editing) {
      await projectsService.update(editing.pk, values);
      toast.success("Proyecto actualizado");
    } else {
      await projectsService.create(values);
      toast.success("Proyecto creado");
    }
    play("success");
    qc.invalidateQueries({ queryKey: ["projects"] });
    // Guardar puede haber creado un Cliente al vuelo (ComboboxCreatable) —
    // sin esto, el próximo formulario no lo vería hasta que expire el
    // staleTime de 60s de "activities-meta".
    qc.invalidateQueries({ queryKey: ["activities-meta"] });
    setOpenForm(false);
    setEditing(null);
  };

  if (isLoading || !projects) {
    return (
      <div className="space-y-6">
        <PageHeader title="Proyectos" description="Avance real de cada frente de trabajo" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Proyectos" description="Avance real de cada frente de trabajo" />
        <EmptyProjects canCreate={canAccessPlanning} onCreate={() => setOpenForm(true)} />
        <FormDialog
          open={openForm}
          editing={editing}
          onOpenChange={(v) => {
            setOpenForm(v);
            if (!v) setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  const term = q.trim().toLowerCase();
  const visibles = projects.filter((p) => {
    const matchTexto =
      !term ||
      p.nombre.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term) ||
      p.cliente.toLowerCase().includes(term);
    const matchSalud = saludFiltro === TODOS || p.metrics.salud === saludFiltro;
    return matchTexto && matchSalud;
  });

  const abiertos = projects.filter((p) => p.estado !== "done" && p.estado !== "cancelled");
  const requierenAtencion = projects.filter(
    (p) => p.metrics.salud === "atrasado" || p.metrics.salud === "en_riesgo",
  ).length;
  const avancePromedio = abiertos.length
    ? Math.round(abiertos.reduce((s, p) => s + p.metrics.avance, 0) / abiertos.length)
    : 0;

  const saludesPresentes = SALUD_ORDEN.filter((s) => projects.some((p) => p.metrics.salud === s));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyectos"
        description="Avance real de cada frente de trabajo"
        actions={
          canAccessPlanning && (
            <Button className="gap-2" onClick={() => setOpenForm(true)}>
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile
          icon={FolderKanban}
          label="Proyectos abiertos"
          value={String(abiertos.length)}
          hint={`${projects.length} en total`}
        />
        <SummaryTile
          icon={TrendingUp}
          label="Avance promedio"
          value={`${avancePromedio}%`}
          hint="Sobre los proyectos abiertos"
        />
        <SummaryTile
          icon={Target}
          label="Requieren atención"
          value={String(requierenAtencion)}
          hint="Atrasados o en riesgo"
          alert={requierenAtencion > 0}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por nombre, código o cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={saludFiltro} onValueChange={setSaludFiltro}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Toda la salud</SelectItem>
            {saludesPresentes.map((s) => (
              <SelectItem key={s} value={s}>
                {SALUD_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {visibles.length} de {projects.length}
        </span>
      </div>

      {visibles.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Ningún proyecto coincide con el filtro.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((p) => (
            <ProjectCard key={p.pk} project={p} />
          ))}
        </div>
      )}

      <FormDialog
        open={openForm}
        editing={editing}
        onOpenChange={(v) => {
          setOpenForm(v);
          if (!v) setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function FormDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  editing: Project | null;
  onOpenChange: (v: boolean) => void;
  onSubmit: (values: ProjectInput) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
          <DialogDescription>
            El avance se calcula solo, a partir de las actividades que amarres a este proyecto.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          // key fuerza el remount al cambiar de proyecto: sin esto el form
          // conserva los defaultValues del anterior.
          key={editing?.pk ?? "nuevo"}
          defaultValues={editing ?? undefined}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
  alert,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className="text-2xl font-semibold"
            style={alert ? { color: "var(--destructive)" } : undefined}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const { metrics } = project;
  const entrega = project.fecha_fin_estimada
    ? format(new Date(project.fecha_fin_estimada), "d MMM yyyy", { locale: es })
    : null;

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: String(project.pk) }}
      className="group block rounded-xl transition-transform hover:-translate-y-0.5"
    >
      <Card className="flex h-full flex-col gap-4 p-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{project.id}</span>
            <HealthBadge salud={metrics.salud} />
          </div>
          <h3 className="font-semibold leading-tight group-hover:text-primary">{project.nombre}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[11px]">
              {PROJECT_ESTADO_LABEL[project.estado]}
            </Badge>
            {project.cliente && (
              <span className="text-xs text-muted-foreground">{project.cliente}</span>
            )}
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <ProgressBar metrics={metrics} />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {project.lider_nombre && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {project.lider_nombre}
              </span>
            )}
            {entrega && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {entrega}
              </span>
            )}
            {metrics.actividades_vencidas > 0 && (
              <span className="font-medium" style={{ color: "var(--destructive)" }}>
                {metrics.actividades_vencidas} vencida
                {metrics.actividades_vencidas === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function EmptyProjects({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-4 p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FolderKanban className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Todavía no hay proyectos</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Un proyecto agrupa actividades y calcula su avance solo, a partir de cuántas están
          finalizadas. Es la respuesta a “¿cómo vamos?” sin tener que contar a mano.
        </p>
      </div>
      {canCreate && (
        <Button size="lg" className="gap-2" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Crear el primero
        </Button>
      )}
    </Card>
  );
}
