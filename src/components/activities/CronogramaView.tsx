import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { activitiesService } from "@/services/activitiesService";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import type { Activity } from "@/lib/types";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { cn } from "@/lib/utils";

type GroupBy = "responsable" | "estado" | "aplicacion";
type Scale = "days" | "weeks";

type CronogramaViewProps = {
  month?: string;
  onMonthChange?: (value: string) => void;
  showHeader?: boolean;
};

const DAY_MS = 86_400_000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtFull(d: Date) {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}
function formatMonth(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
function parseMonth(value: string) {
  const parts = value.split("-");
  if (parts.length !== 2) return startOfDay(new Date());
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return startOfDay(new Date());
  return new Date(year, monthIndex, 1);
}
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function shiftMonth(value: string, delta: number) {
  const d = parseMonth(value);
  d.setMonth(d.getMonth() + delta);
  return formatMonth(d);
}

export function CronogramaView({ month, onMonthChange, showHeader = true }: CronogramaViewProps) {
  const { activeStates, activePriorities, stateById, priorityById } = useWorkspace();
  const [localMonth, setLocalMonth] = useState(() => formatMonth(new Date()));
  const isControlled = typeof month === "string";
  const activeMonth = isControlled ? month : localMonth;
  const setMonth = isControlled ? (onMonthChange ?? (() => {})) : setLocalMonth;

  const [week, setWeek] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("responsable");
  const [scale, setScale] = useState<Scale>("days");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<number | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<number | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["activities-plan", activeMonth, week],
    queryFn: () =>
      activitiesService.listByPlan({
        mes_planeacion: activeMonth,
        semana_planeacion: week === "all" ? undefined : Number(week),
      }),
  });

  const monthStart = useMemo(() => parseMonth(activeMonth), [activeMonth]);
  const totalDays = useMemo(() => daysInMonth(monthStart), [monthStart]);
  const colWidth = scale === "days" ? 36 : 84;
  const rangeStart = monthStart;
  const rangeEnd = useMemo(() => addDays(rangeStart, totalDays), [rangeStart, totalDays]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    const weekValue = week === "all" ? null : Number(week);
    return list.filter((a) => {
      if (weekValue && a.semana_planeacion !== weekValue) return false;
      if (statusFilter !== "all" && a.estado_id !== statusFilter) return false;
      if (priorityFilter !== "all" && a.prioridad_id !== priorityFilter) return false;
      if (!q) return true;
      return (
        a.nombre.toLowerCase().includes(q) ||
        a.responsable.toLowerCase().includes(q) ||
        a.aplicacion.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      );
    });
  }, [data, query, week, statusFilter, priorityFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of filtered) {
      const key =
        groupBy === "responsable"
          ? a.responsable
          : groupBy === "estado"
            ? (stateById[a.estado_id]?.nombre ?? "—")
            : a.aplicacion;
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy, stateById]);

  const today = startOfDay(new Date());
  const todayOffset = Math.round((today.getTime() - rangeStart.getTime()) / DAY_MS);
  const showToday = todayOffset >= 0 && todayOffset <= totalDays;

  // Column headers
  const headers = useMemo(() => {
    const arr: { label: string; sub?: string; isWeekStart?: boolean }[] = [];
    if (scale === "days") {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(rangeStart, i);
        arr.push({
          label: String(d.getDate()),
          sub: d.toLocaleDateString("es-ES", { weekday: "narrow" }),
          isWeekStart: (d.getDate() - 1) % 7 === 0,
        });
      }
    } else {
      const totalWeeks = 5;
      for (let weekIndex = 1; weekIndex <= totalWeeks; weekIndex++) {
        const startDay = (weekIndex - 1) * 7 + 1;
        const endDay = Math.min(weekIndex * 7, totalDays);
        const sub =
          startDay <= totalDays
            ? `${String(startDay).padStart(2, "0")}–${String(endDay).padStart(2, "0")}`
            : "—";
        arr.push({ label: `S${weekIndex}`, sub, isWeekStart: true });
      }
    }
    return arr;
  }, [rangeStart, totalDays, scale]);

  const headerCols = scale === "days" ? totalDays : 5;
  const timelineWidth = headerCols * colWidth;

  function barFor(a: Activity) {
    const s = startOfDay(new Date(a.fechaInicio));
    const e = startOfDay(new Date(a.fechaLimite));
    const startOffset = Math.max(0, Math.round((s.getTime() - rangeStart.getTime()) / DAY_MS));
    const endOffset = Math.min(
      totalDays,
      Math.round((e.getTime() - rangeStart.getTime()) / DAY_MS) + 1,
    );
    if (endOffset <= 0 || startOffset >= totalDays) return null;
    const left = (startOffset / totalDays) * timelineWidth;
    const width = Math.max(colWidth * 0.6, ((endOffset - startOffset) / totalDays) * timelineWidth);
    return { left, width };
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <PageHeader
          title="Cronograma"
          description="Cronograma visual tipo Gantt de las actividades del equipo."
        />
      )}

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <Input
          type="month"
          value={activeMonth}
          onChange={(e) => setMonth(e.target.value)}
          className="max-w-[160px]"
        />
        <Select value={week} onValueChange={setWeek}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Semana" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semana: Todas</SelectItem>
            <SelectItem value="1">Semana 1</SelectItem>
            <SelectItem value="2">Semana 2</SelectItem>
            <SelectItem value="3">Semana 3</SelectItem>
            <SelectItem value="4">Semana 4</SelectItem>
            <SelectItem value="5">Semana 5</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar actividad, responsable o app…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={String(statusFilter)}
          onValueChange={(v) => setStatusFilter(v === "all" ? "all" : Number(v))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Estado: Todos</SelectItem>
            {activeStates.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(priorityFilter)}
          onValueChange={(v) => setPriorityFilter(v === "all" ? "all" : Number(v))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Prioridad: Todas</SelectItem>
            {activePriorities.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="responsable">Agrupar: Responsable</SelectItem>
            <SelectItem value="estado">Agrupar: Estado</SelectItem>
            <SelectItem value="aplicacion">Agrupar: Aplicación</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scale} onValueChange={(v) => setScale(v as Scale)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="days">Vista: Días</SelectItem>
            <SelectItem value="weeks">Vista: Semanas</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(shiftMonth(activeMonth, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(formatMonth(new Date()))}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(shiftMonth(activeMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-2">
            {fmtFull(rangeStart)} – {fmtFull(addDays(rangeEnd, -1))}
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <CalendarRange className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Sin actividades para mostrar</p>
            <p className="text-sm">
              Crea actividades desde el módulo Actividades para verlas aquí.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-fit">
              {/* Left fixed column */}
              <div className="w-72 shrink-0 border-r bg-card sticky left-0 z-10">
                <div className="h-14 border-b flex items-end px-4 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
                  {groupBy === "responsable"
                    ? "Responsable / Tarea"
                    : groupBy === "estado"
                      ? "Estado / Tarea"
                      : "Aplicación / Tarea"}
                </div>
                {groups.map(([groupName, items]) => (
                  <div key={groupName}>
                    <div className="h-9 flex items-center px-4 text-sm font-semibold bg-muted/40 border-b">
                      {groupName}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({items.length})
                      </span>
                    </div>
                    {items.map((a) => (
                      <div
                        key={a.id}
                        className="h-10 flex items-center px-4 text-sm border-b truncate"
                        title={a.nombre}
                      >
                        <span className="text-xs text-muted-foreground mr-2 font-mono">{a.id}</span>
                        <span className="truncate">{a.nombre}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div className="relative" style={{ width: timelineWidth }}>
                {/* Header */}
                <div className="h-14 border-b flex bg-muted/30">
                  {headers.map((h, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex flex-col items-center justify-end pb-1 text-[10px] text-muted-foreground border-r",
                        h.isWeekStart && "border-l border-l-border/80",
                      )}
                      style={{ width: colWidth }}
                    >
                      <span className="font-semibold text-foreground text-xs leading-none">
                        {h.label}
                      </span>
                      {h.sub && <span className="leading-none mt-0.5">{h.sub}</span>}
                    </div>
                  ))}
                </div>

                {/* Today line */}
                {showToday && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary z-20 pointer-events-none"
                    style={{ left: (todayOffset / totalDays) * timelineWidth }}
                  >
                    <div className="absolute -top-0.5 -left-1 w-2 h-2 rounded-full bg-primary" />
                  </div>
                )}

                {/* Rows */}
                {groups.map(([groupName, items]) => (
                  <div key={groupName}>
                    <div className="h-9 border-b bg-muted/20 relative">
                      {/* grid */}
                      <div className="absolute inset-0 flex">
                        {headers.map((h, i) => (
                          <div
                            key={i}
                            className={cn(
                              "border-r border-border/40",
                              h.isWeekStart && "border-l border-l-border/70",
                            )}
                            style={{ width: colWidth }}
                          />
                        ))}
                      </div>
                    </div>
                    {items.map((a) => {
                      const bar = barFor(a);
                      const color = stateById[a.estado_id]?.color ?? "var(--muted-foreground)";
                      const priorityColor =
                        priorityById[a.prioridad_id]?.color ?? "var(--muted-foreground)";
                      const weekTag = a.semana_planeacion ? `S${a.semana_planeacion}` : null;
                      return (
                        <div key={a.id} className="h-10 border-b relative group">
                          {/* grid lines */}
                          <div className="absolute inset-0 flex">
                            {headers.map((h, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "border-r border-border/30",
                                  h.isWeekStart && "border-l border-l-border/60",
                                )}
                                style={{ width: colWidth }}
                              />
                            ))}
                          </div>
                          {bar && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="absolute top-1.5 h-7 rounded-md shadow-sm cursor-pointer transition-all hover:brightness-110 hover:shadow-md flex items-center px-2 overflow-hidden"
                                    style={{
                                      left: bar.left + 2,
                                      width: bar.width - 4,
                                      background: `color-mix(in oklab, ${color} 22%, transparent)`,
                                      borderLeft: `3px solid ${color}`,
                                      borderTop: `2px solid ${priorityColor}`,
                                    }}
                                  >
                                    <span
                                      className="h-2 w-2 rounded-full mr-2 shrink-0"
                                      style={{ background: priorityColor }}
                                    />
                                    {scale === "weeks" && weekTag && (
                                      <span
                                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted/60 mr-2"
                                        style={{ color }}
                                      >
                                        {weekTag}
                                      </span>
                                    )}
                                    <span
                                      className="text-[11px] font-medium truncate"
                                      style={{ color }}
                                    >
                                      {a.nombre}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-1">
                                    <p className="font-semibold">{a.nombre}</p>
                                    <p className="text-xs opacity-80">
                                      {a.id} · {a.aplicacion}
                                    </p>
                                    <p className="text-xs">Responsable: {a.responsable}</p>
                                    <p className="text-xs">
                                      Estado: {stateById[a.estado_id]?.nombre ?? "—"} · Prioridad:{" "}
                                      {priorityById[a.prioridad_id]?.nombre ?? "—"}
                                    </p>
                                    <p className="text-xs">
                                      {fmtFull(new Date(a.fechaInicio))} →{" "}
                                      {fmtFull(new Date(a.fechaLimite))}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
