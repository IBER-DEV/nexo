import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { activitiesService } from "@/services/activitiesService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityForm } from "@/components/activities/ActivityForm";
import type { Activity, ActivityInput } from "@/lib/types";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
  ArrowUpDown,
  CalendarIcon,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useSound } from "@/providers/SoundProvider";

type ActivitiesSearch = {
  q: string;
  new?: boolean;
};

export const Route = createFileRoute("/_app/activities")({
  validateSearch: (search: Record<string, unknown>): ActivitiesSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    new: search.new === true || search.new === "1" || search.new === "true",
  }),
  head: () => ({
    meta: [
      { title: "Actividades · Nexo" },
      {
        name: "description",
        content: "Listado completo de actividades del equipo TI con filtros y búsqueda.",
      },
    ],
  }),
  component: ActivitiesPage,
});

type SortKey = "id" | "nombre" | "responsable" | "prioridad" | "estado" | "fechaLimite";

function ActivitiesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { play } = useSound();
  const { activeStates, activePriorities, stateById, priorityById, isOpen } = useWorkspace();
  const { q: urlQ, new: openNew } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesService.list(),
  });

  const [search, setSearch] = useState(urlQ);
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterPrioridad, setFilterPrioridad] = useState<string>("all");
  const [filterResponsable, setFilterResponsable] = useState<string>("all");
  const [filterInicioDesde, setFilterInicioDesde] = useState<Date | null>(null);
  const [filterInicioHasta, setFilterInicioHasta] = useState<Date | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "id",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setSearch(urlQ);
    setPage(1);
  }, [urlQ]);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);

  // Deep-link desde el empty state del dashboard: /activities?new=1 abre el
  // formulario de creación directo, sin que el usuario tenga que encontrar
  // el botón "Nueva actividad".
  useEffect(() => {
    if (openNew) setOpenForm(true);
  }, [openNew]);

  const responsables = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.map((a) => a.responsable)));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [] as Activity[];
    const q = search.toLowerCase().trim();
    let rows = data.filter((a) => {
      if (filterEstado !== "all" && String(a.estado_id) !== filterEstado) return false;
      if (filterPrioridad !== "all" && String(a.prioridad_id) !== filterPrioridad) return false;
      if (filterResponsable !== "all" && a.responsable !== filterResponsable) return false;
      const inicio = dateOnly(new Date(a.fechaInicio));
      if (filterInicioDesde && inicio < dateOnly(filterInicioDesde)) return false;
      if (filterInicioHasta && inicio > dateOnly(filterInicioHasta)) return false;
      if (
        q &&
        !`${a.id} ${a.nombre} ${a.descripcion} ${a.responsable} ${a.stakeholder} ${a.empresa} ${a.proceso} ${a.aplicacion}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "prioridad") {
        const oa = priorityById[a.prioridad_id]?.orden ?? 0;
        const ob = priorityById[b.prioridad_id]?.orden ?? 0;
        return (oa - ob) * dir;
      }
      if (sort.key === "estado") {
        const oa = stateById[a.estado_id]?.orden ?? 0;
        const ob = stateById[b.estado_id]?.orden ?? 0;
        return (oa - ob) * dir;
      }
      if (sort.key === "fechaLimite")
        return (new Date(a.fechaLimite).getTime() - new Date(b.fechaLimite).getTime()) * dir;
      const key = sort.key as "id" | "nombre" | "responsable";
      const va = String(a[key]).toLowerCase();
      const vb = String(b[key]).toLowerCase();
      return va.localeCompare(vb) * dir;
    });
    return rows;
  }, [
    data,
    search,
    filterEstado,
    filterPrioridad,
    filterResponsable,
    filterInicioDesde,
    filterInicioHasta,
    sort,
    priorityById,
    stateById,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  };

  const exportCSV = () => {
    const headers = [
      "ID",
      "Empresa",
      "Proceso",
      "Aplicación",
      "Nombre",
      "Responsable",
      "Stakeholder",
      "Prioridad",
      "Estado",
      "Fecha inicio",
      "Fecha límite",
    ];
    const rows = filtered.map((a) => [
      a.id,
      a.empresa,
      a.proceso,
      a.aplicacion,
      a.nombre,
      a.responsable,
      a.stakeholder,
      priorityById[a.prioridad_id]?.nombre ?? "",
      stateById[a.estado_id]?.nombre ?? "",
      format(new Date(a.fechaInicio), "yyyy-MM-dd"),
      format(new Date(a.fechaLimite), "yyyy-MM-dd"),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `actividades-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado a CSV");
  };

  const handleSubmit = async (values: ActivityInput) => {
    if (editing) {
      await activitiesService.update(editing.pk, values);
      toast.success("Actividad actualizada");
    } else {
      await activitiesService.create(values);
      toast.success("Actividad creada");
    }
    play("success");
    qc.invalidateQueries({ queryKey: ["activities"] });
    setOpenForm(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await activitiesService.remove(deleting.pk);
    qc.invalidateQueries({ queryKey: ["activities"] });
    toast.success("Actividad eliminada");
    play("droplet");
    setDeleting(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Actividades"
        description="Gestión completa del backlog técnico"
        actions={
          <>
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setOpenForm(true);
              }}
              className="gap-2 text-white"
              data-cuelume-press
              data-cuelume-release
            >
              <Plus className="h-4 w-4 t" /> Nueva actividad
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="space-y-3">
          <div className="grid gap-2 xl:grid-cols-[minmax(260px,1.2fr)_repeat(3,auto)]">
            <div className="relative min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, nombre, responsable..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearch(v);
                  setPage(1);
                  navigate({ to: "/activities", search: { q: v }, replace: true });
                }}
              />
            </div>
            <Select
              value={filterEstado}
              onValueChange={(v) => {
                setFilterEstado(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {activeStates.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterPrioridad}
              onValueChange={(v) => {
                setFilterPrioridad(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {activePriorities.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterResponsable}
              onValueChange={(v) => {
                setFilterResponsable(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-52 h-9">
                <SelectValue placeholder="Responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los responsables</SelectItem>
                {responsables.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <DateRangeFilter
              label="Fecha inicio"
              from={filterInicioDesde}
              to={filterInicioHasta}
              onFromChange={(value) => {
                setFilterInicioDesde(value);
                setPage(1);
              }}
              onToChange={(value) => {
                setFilterInicioHasta(value);
                setPage(1);
              }}
            />
            {(filterInicioDesde || filterInicioHasta) && (
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterInicioDesde(null);
                    setFilterInicioHasta(null);
                    setPage(1);
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <SortableHead onClick={() => toggleSort("id")}>ID</SortableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Proceso</TableHead>
                  <TableHead>Aplicación</TableHead>
                  <SortableHead onClick={() => toggleSort("nombre")}>Actividad</SortableHead>
                  <TableHead>Descripción</TableHead>
                  <SortableHead onClick={() => toggleSort("responsable")}>Responsable</SortableHead>
                  <TableHead>Stakeholder</TableHead>
                  <TableHead>Fecha inicio</TableHead>
                  <SortableHead onClick={() => toggleSort("fechaLimite")}>
                    Fecha límite
                  </SortableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                {!isLoading && paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="h-8 w-8 opacity-50" />
                        <p className="font-medium text-foreground">Sin resultados</p>
                        <p className="text-sm">Prueba ajustando los filtros o la búsqueda.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {paged.map((a) => {
                  const vencida =
                    new Date(a.fechaLimite).getTime() < Date.now() && isOpen(a.estado_id);
                  return (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {a.id}
                      </TableCell>
                      <TableCell className="text-sm">{a.empresa}</TableCell>
                      <TableCell className="text-sm">{a.proceso}</TableCell>
                      <TableCell className="text-sm">{a.aplicacion}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{a.nombre}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="max-w-sm truncate" title={a.descripcion || undefined}>
                          {a.descripcion || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{a.responsable}</TableCell>
                      <TableCell className="text-sm">{a.stakeholder}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {format(new Date(a.fechaInicio), "d MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell
                        className={`text-sm tabular-nums ${vencida ? "text-destructive font-medium" : ""}`}
                      >
                        {format(new Date(a.fechaLimite), "d MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(a);
                                setOpenForm(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleting(a)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{filtered.length} actividades</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="px-2">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={openForm}
        onOpenChange={(o) => {
          setOpenForm(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar actividad" : "Nueva actividad"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Actualiza los datos de ${editing.id}.`
                : "Registra una nueva actividad del equipo TI."}
            </DialogDescription>
          </DialogHeader>
          <ActivityForm
            defaultValues={editing ?? undefined}
            onSubmit={handleSubmit}
            onCancel={() => {
              setOpenForm(false);
              setEditing(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. {deleting?.id} será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableHead({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <TableHead>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function DateRangeFilter({
  label,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  label: string;
  from: Date | null;
  to: Date | null;
  onFromChange: (value: Date | null) => void;
  onToChange: (value: Date | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
        {label}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <DatePick label="Desde" value={from} onChange={onFromChange} />
        <DatePick label="Hasta" value={to} onChange={onToChange} />
      </div>
    </div>
  );
}

function DatePick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 min-w-[150px] justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "d MMM yyyy", { locale: es }) : "Selecciona"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(d) => onChange(d ?? null)}
            initialFocus
            className="p-3 pointer-events-auto"
          />
          <div className="flex justify-end px-3 pb-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Limpiar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
