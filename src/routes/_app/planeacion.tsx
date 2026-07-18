import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { activitiesService } from "@/services/activitiesService";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { CronogramaView } from "@/components/activities/CronogramaView";
import { CalendarView } from "@/components/activities/CalendarView";
import { StatusBadge } from "@/components/activities/StatusBadge";
import { PriorityBadge } from "@/components/activities/PriorityBadge";
import { MetricCard } from "@/components/dashboard/MetricCard";
import type { Activity, ActivityInput } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlus, Upload, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { useSound } from "@/providers/SoundProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";

export const Route = createFileRoute("/_app/planeacion")({
  head: () => ({
    meta: [
      { title: "Planeación semanal · Nexo" },
      { name: "description", content: "Planeación mensual por semanas para el equipo TI." },
    ],
  }),
  component: PlaneacionPage,
});

const WEEKS = [1, 2, 3, 4, 5];

function PlaneacionPage() {
  const { canAccessPlanning } = useAuth();
  const { play } = useSound();
  const { isDone, isOpen, isCancelled } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [view, setView] = useState<"semanas" | "cronograma" | "calendario">("semanas");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importWeek, setImportWeek] = useState<number | "auto">("auto");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!canAccessPlanning) {
      navigate({ to: "/", replace: true });
    }
  }, [canAccessPlanning, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["activities-plan", month],
    queryFn: () => activitiesService.listByPlan({ mes_planeacion: month }),
    enabled: canAccessPlanning && view === "semanas",
  });

  const byWeek = useMemo(() => {
    const map = new Map<number, Activity[]>();
    WEEKS.forEach((week) => map.set(week, []));
    (data ?? []).forEach((activity) => {
      if (activity.semana_planeacion && map.has(activity.semana_planeacion)) {
        map.get(activity.semana_planeacion)?.push(activity);
      }
    });
    return map;
  }, [data]);

  const activeWeek = useMemo(() => currentWeekOfMonth(month), [month]);

  const weeksToShow = useMemo(
    () =>
      WEEKS.filter((week) => weekExistsInMonth(month, week) || (byWeek.get(week)?.length ?? 0) > 0),
    [month, byWeek],
  );

  const monthStats = useMemo(() => {
    const list = data ?? [];
    const now = Date.now();
    const done = list.filter((a) => isDone(a.estado_id)).length;
    const overdue = list.filter(
      (a) => new Date(a.fechaLimite).getTime() < now && isOpen(a.estado_id),
    ).length;
    const pending = list.length - done - list.filter((a) => isCancelled(a.estado_id)).length;
    return { total: list.length, done, pending, overdue };
  }, [data, isDone, isOpen, isCancelled]);

  if (!canAccessPlanning) {
    return null;
  }

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
    qc.invalidateQueries({ queryKey: ["activities-plan", month] });
    setOpenForm(false);
    setEditing(null);
    setSelectedWeek(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await activitiesService.remove(deleting.pk);
    qc.invalidateQueries({ queryKey: ["activities"] });
    qc.invalidateQueries({ queryKey: ["activities-plan", month] });
    toast.success("Actividad eliminada");
    play("droplet");
    setDeleting(null);
  };

  const openNew = (week: number) => {
    setSelectedWeek(week);
    setEditing(null);
    setOpenForm(true);
  };

  const openEdit = (activity: Activity) => {
    setSelectedWeek(null);
    setEditing(activity);
    setOpenForm(true);
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Selecciona un archivo Excel");
      return;
    }
    setImporting(true);
    try {
      const result = await activitiesService.importExcel(importFile, {
        mes_planeacion: month,
        semana_planeacion: importWeek === "auto" ? undefined : importWeek,
      });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["activities-plan", month] });
      toast.success(`Importado: ${result.created} creadas, ${result.updated} actualizadas`);
      play("success");
      if (result.skipped) {
        toast.info(`Filas omitidas: ${result.skipped}`);
      }
      setImportOpen(false);
      setImportFile(null);
      setImportWeek("auto");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planeación semanal"
        description="Organiza el mes en semanas y gestiona las actividades"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "semanas" | "cronograma" | "calendario")}
        >
          <TabsList>
            <TabsTrigger value="semanas">Semanas</TabsTrigger>
            <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
            <TabsTrigger value="calendario">Calendario</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Importar Excel
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => openNew(1)}
            data-cuelume-press
            data-cuelume-release
          >
            <CalendarPlus className="h-4 w-4" /> Nueva actividad
          </Button>
        </div>
      </div>

      <div key={view} className="animate-fade-in space-y-6">
        {view === "semanas" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-9 w-44"
                aria-label="Mes"
              />
              <span className="text-xs text-muted-foreground">
                {weeksToShow
                  .filter((week) => weekExistsInMonth(month, week))
                  .map((week) => weekRangeLabel(month, week))
                  .join(" · ")}
              </span>
            </div>

            {!isLoading && monthStats.total > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Actividades del mes" value={monthStats.total} accent="primary" />
                <MetricCard label="Completadas" value={monthStats.done} accent="success" />
                <MetricCard label="Pendientes" value={monthStats.pending} accent="info" />
                <MetricCard label="Vencidas" value={monthStats.overdue} accent="danger" />
              </div>
            )}

            {isLoading ? (
              <div className="grid lg:grid-cols-2 gap-4">
                {WEEKS.map((week) => (
                  <Skeleton key={week} className="h-64 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {weeksToShow.map((week) => {
                  const exists = weekExistsInMonth(month, week);
                  const isCurrent = activeWeek === week;
                  const items = byWeek.get(week) ?? [];
                  return (
                    <Card
                      key={week}
                      className={`p-4 flex flex-col gap-3 ${isCurrent ? "ring-2 ring-primary/50 border-primary/40" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <h3 className="text-sm font-semibold">Semana {week}</h3>
                            <p className="text-xs text-muted-foreground">
                              {items.length} actividades
                            </p>
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-primary bg-primary/10 rounded-full px-2 py-0.5">
                              Actual
                            </span>
                          )}
                        </div>
                        {exists && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openNew(week)}
                            data-cuelume-press
                            data-cuelume-release
                          >
                            Nueva
                          </Button>
                        )}
                      </div>

                      {items.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic text-center py-6 border border-dashed border-border rounded-lg">
                          Sin actividades
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {items.map((activity) => {
                            const vencida =
                              new Date(activity.fechaLimite).getTime() < Date.now() &&
                              isOpen(activity.estado_id);
                            return (
                              <div
                                key={activity.id}
                                className="group relative rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
                              >
                                <div className="flex items-center gap-2 pr-14">
                                  <span className="text-[10px] font-mono font-semibold text-primary shrink-0">
                                    {activity.id}
                                  </span>
                                  <span className="text-sm font-medium truncate min-w-0">
                                    {activity.nombre}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {activity.responsable} · {activity.aplicacion}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                  <PriorityBadge prioridadId={activity.prioridad_id} />
                                  <StatusBadge estadoId={activity.estado_id} />
                                </div>
                                <p
                                  className={`text-[11px] tabular-nums mt-2 ${vencida ? "text-destructive font-medium" : "text-muted-foreground"}`}
                                >
                                  {format(new Date(activity.fechaInicio), "d MMM", { locale: es })}{" "}
                                  -{" "}
                                  {format(new Date(activity.fechaLimite), "d MMM", { locale: es })}
                                </p>
                                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => openEdit(activity)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => setDeleting(activity)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : view === "cronograma" ? (
          <CronogramaView month={month} onMonthChange={setMonth} showHeader={false} />
        ) : (
          <CalendarView month={month} onMonthChange={setMonth} onEdit={openEdit} />
        )}
      </div>

      <Dialog
        open={openForm}
        onOpenChange={(o) => {
          setOpenForm(o);
          if (!o) {
            setEditing(null);
            setSelectedWeek(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar actividad" : "Nueva actividad"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Actualiza los datos de ${editing.id}.`
                : "Registra una nueva actividad en la semana."}
            </DialogDescription>
          </DialogHeader>
          <ActivityForm
            defaultValues={
              editing ??
              (selectedWeek
                ? {
                    mes_planeacion: month,
                    semana_planeacion: selectedWeek,
                    fechaInicio: buildWeekStart(month, selectedWeek).toISOString(),
                    fechaLimite: buildWeekEnd(month, selectedWeek).toISOString(),
                  }
                : undefined)
            }
            onSubmit={handleSubmit}
            onCancel={() => {
              setOpenForm(false);
              setEditing(null);
              setSelectedWeek(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(o) => !o && setImportOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar actividades</DialogTitle>
            <DialogDescription>
              Sube el Excel semanal y asigna mes/semana destino.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Archivo Excel</label>
              <Input
                type="file"
                accept=".xlsx"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Mes destino</label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Semana destino</label>
              <Select
                value={String(importWeek)}
                onValueChange={(v) => setImportWeek(v === "auto" ? "auto" : parseInt(v, 10))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar semana" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detectar automaticamente</SelectItem>
                  {WEEKS.map((week) => (
                    <SelectItem key={week} value={String(week)}>
                      Semana {week}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing} className="gap-2">
              <Upload className="h-4 w-4" /> {importing ? "Importando..." : "Importar"}
            </Button>
          </div>
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

function daysInMonth(month: string) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return new Date(year, monthIndex + 1, 0).getDate();
}

function weekExistsInMonth(month: string, week: number) {
  return 1 + (week - 1) * 7 <= daysInMonth(month);
}

function currentWeekOfMonth(month: string) {
  const today = new Date();
  if (format(today, "yyyy-MM") !== month) return null;
  return Math.min(5, Math.ceil(today.getDate() / 7));
}

function weekRangeLabel(month: string, week: number) {
  const start = 1 + (week - 1) * 7;
  const total = daysInMonth(month);
  const end = Math.min(week * 7, total);
  const isLast = end >= total;
  return `Semana ${week}: ${start}-${isLast ? "fin" : end}`;
}

function buildWeekStart(month: string, week: number) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Math.min(1 + (week - 1) * 7, daysInMonth(month));
  return new Date(year, monthIndex, day);
}

function buildWeekEnd(month: string, week: number) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const lastDay = daysInMonth(month);
  const day = Math.min(week * 7, lastDay);
  return new Date(year, monthIndex, day);
}
