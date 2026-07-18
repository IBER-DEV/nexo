import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventDropArg, EventInput } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import { activitiesService } from "@/services/activitiesService";
import type { Activity } from "@/lib/types";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type CalendarViewProps = {
  month?: string;
  onMonthChange?: (value: string) => void;
  onEdit?: (activity: Activity) => void;
};

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

function parseActivityDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = value.includes("T") ? value.split("T")[0] : value;
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, monthIndex, day);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function asISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekOfMonth(d: Date) {
  const day = d.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

function monthsInRange(start: Date, end: Date) {
  const months = new Set<string>();
  const cursor = startOfDay(new Date(start));
  const limit = startOfDay(new Date(end));
  while (cursor < limit) {
    months.add(formatMonth(cursor));
    cursor.setMonth(cursor.getMonth() + 1, 1);
  }
  return Array.from(months).sort();
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Cada actividad se muestra solo en su fecha de inicio; el límite va en tooltip/badge.
 * El color del estado viaja como CSS var inline en vez de una clase fija
 * (fc-act-{estado}) — el maestro de estados es configurable por org. */
function activityToEvent(activity: Activity, stateColor: string): EventInput | null {
  const start = parseActivityDate(activity.fechaInicio);
  if (!start) return null;

  return {
    id: String(activity.pk),
    title: activity.nombre,
    start: asISODate(start),
    allDay: true,
    extendedProps: { activity },
    display: "block",
    backgroundColor: `color-mix(in oklab, ${stateColor} 20%, transparent)`,
    borderColor: stateColor,
    textColor: stateColor,
  };
}

function overlapsVisibleRange(activity: Activity, rangeStart: Date, rangeEnd: Date) {
  const start = parseActivityDate(activity.fechaInicio);
  if (!start) return false;
  return start >= rangeStart && start < rangeEnd;
}

function formatDateShort(value: string) {
  const d = parseActivityDate(value);
  if (!d) return "—";
  return format(d, "d MMM", { locale: es });
}

function getSpanDays(fechaInicio: string, fechaLimite: string): number {
  const start = parseActivityDate(fechaInicio);
  const end = parseActivityDate(fechaLimite);
  if (!start) return 1;
  const effectiveEnd = end && end >= start ? end : start;
  return Math.round((effectiveEnd.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Badge en el chip: "→ 24 abr" si la fecha límite es posterior al inicio */
function formatDeadlineBadge(fechaInicio: string, fechaLimite: string): string | null {
  const start = parseActivityDate(fechaInicio);
  const end = parseActivityDate(fechaLimite);
  if (!start || !end || end.getTime() <= start.getTime()) return null;
  return `→ ${format(end, "d MMM", { locale: es })}`;
}

export function CalendarView({ month, onMonthChange, onEdit }: CalendarViewProps) {
  const [localMonth, setLocalMonth] = useState(() => formatMonth(new Date()));
  const [mounted, setMounted] = useState(false);
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date } | null>(null);

  const { activeStates, activePriorities, stateById, priorityById } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState<number | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<number | "all">("all");
  const [responsableFilter, setResponsableFilter] = useState<string>("all");

  const isControlled = typeof month === "string";
  const activeMonth = isControlled ? month : localMonth;
  const setMonth = isControlled ? (onMonthChange ?? (() => {})) : setLocalMonth;

  const qc = useQueryClient();
  const calendarRef = useRef<FullCalendar | null>(null);
  const syncingMonth = useRef(false);

  const fetchMonths = useMemo(() => {
    if (visibleRange) return monthsInRange(visibleRange.start, visibleRange.end);
    return [activeMonth];
  }, [visibleRange, activeMonth]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["activities-calendar", fetchMonths.join(",")],
    queryFn: async () => {
      const batches = await Promise.all(
        fetchMonths.map((m) => activitiesService.listByPlan({ mes_planeacion: m })),
      );
      const map = new Map<number, Activity>();
      batches.flat().forEach((activity) => map.set(activity.pk, activity));
      return Array.from(map.values());
    },
  });

  const responsables = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((a) => set.add(a.responsable));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((a) => {
      if (statusFilter !== "all" && a.estado_id !== statusFilter) return false;
      if (priorityFilter !== "all" && a.prioridad_id !== priorityFilter) return false;
      if (responsableFilter !== "all" && a.responsable !== responsableFilter) return false;
      if (visibleRange && !overlapsVisibleRange(a, visibleRange.start, visibleRange.end))
        return false;
      return true;
    });
  }, [data, statusFilter, priorityFilter, responsableFilter, visibleRange]);

  const events = useMemo(() => {
    return filtered
      .map((a) => activityToEvent(a, stateById[a.estado_id]?.color ?? "var(--muted-foreground)"))
      .filter((event): event is EventInput => event !== null);
  }, [filtered, stateById]);

  const activeFilterCount = [statusFilter, priorityFilter, responsableFilter].filter(
    (f) => f !== "all",
  ).length;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const api = calendarRef.current?.getApi();
    if (!api) return;

    syncingMonth.current = true;
    const nextDate = parseMonth(activeMonth);
    const currentMonth = formatMonth(api.getDate());
    if (currentMonth !== activeMonth) {
      api.gotoDate(nextDate);
    }
    queueMicrotask(() => {
      syncingMonth.current = false;
    });
  }, [activeMonth, mounted]);

  const handleEventDrop = async (info: EventDropArg) => {
    const activity = info.event.extendedProps.activity as Activity | undefined;
    if (!info.event.start || !activity) return;

    const newStart = startOfDay(info.event.start);
    let fechaLimite = parseActivityDate(activity.fechaLimite);
    if (!fechaLimite || fechaLimite < newStart) {
      fechaLimite = newStart;
    }

    const patch = {
      fechaInicio: asISODate(newStart),
      fechaLimite: asISODate(fechaLimite),
      mes_planeacion: formatMonth(newStart),
      semana_planeacion: weekOfMonth(newStart),
    };

    try {
      await activitiesService.update(Number(info.event.id), patch);
      qc.invalidateQueries({ queryKey: ["activities-calendar"] });
      qc.invalidateQueries({ queryKey: ["activities-plan"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Fecha de inicio actualizada");
    } catch (error) {
      info.revert();
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la actividad");
    }
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setVisibleRange({ start: arg.start, end: arg.end });
    const viewMonth = formatMonth(arg.view.currentStart);
    if (!syncingMonth.current && viewMonth !== activeMonth) {
      setMonth(viewMonth);
    }
  };

  const goToMonth = (value: string) => {
    setMonth(value);
    calendarRef.current?.getApi()?.gotoDate(parseMonth(value));
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setResponsableFilter("all");
  };

  return (
    <div className="space-y-3">
      {/* Filters bar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(statusFilter)}
            onValueChange={(v) => setStatusFilter(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {activeStates.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.nombre}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(priorityFilter)}
            onValueChange={(v) => setPriorityFilter(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las prioridades</SelectItem>
              {activePriorities.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    {p.nombre}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={responsableFilter} onValueChange={setResponsableFilter}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los responsables</SelectItem>
              {responsables.map((r) => (
                <SelectItem key={r} value={r}>
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                      {getInitials(r)}
                    </span>
                    {r}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border hover:bg-muted/50"
            >
              Limpiar filtros
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {filtered.length} actividad{filtered.length !== 1 ? "es" : ""}
            </span>
            <Input
              type="month"
              value={activeMonth}
              onChange={(e) => goToMonth(e.target.value)}
              className="h-8 max-w-[145px] text-xs"
              aria-label="Ir a mes"
            />
          </div>
        </div>
      </Card>

      {/* Calendar */}
      <Card className="overflow-hidden p-0">
        {!mounted || (isLoading && !data) ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[460px] w-full rounded-lg" />
          </div>
        ) : (
          <div className="nexo-calendar p-3 sm:p-4 relative">
            {isFetching && (
              <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden">
                <div className="h-full w-full bg-primary/30 animate-pulse" />
              </div>
            )}
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              initialDate={parseMonth(activeMonth)}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              locale={esLocale}
              firstDay={1}
              weekends={false}
              contentHeight="auto"
              stickyHeaderDates
              fixedWeekCount={false}
              dayMaxEvents={4}
              moreLinkClick="popover"
              displayEventEnd={false}
              editable
              eventStartEditable
              eventDurationEditable={false}
              eventResizableFromStart={false}
              eventDrop={handleEventDrop}
              events={events}
              views={{
                dayGridMonth: {
                  dayMaxEvents: 4,
                },
                timeGridWeek: {
                  slotMinTime: "07:00:00",
                  slotMaxTime: "20:00:00",
                  slotDuration: "00:30:00",
                  allDaySlot: true,
                  nowIndicator: true,
                },
                timeGridDay: {
                  slotMinTime: "07:00:00",
                  slotMaxTime: "20:00:00",
                  slotDuration: "00:30:00",
                  allDaySlot: true,
                  nowIndicator: true,
                },
              }}
              eventContent={(arg) => {
                const activity = arg.event.extendedProps.activity as Activity | undefined;
                if (!activity) {
                  return <span className="fc-event-title">{arg.event.title}</span>;
                }

                const priorityColor =
                  priorityById[activity.prioridad_id]?.color ?? "var(--muted-foreground)";
                const initials = getInitials(activity.responsable);
                const spanDays = getSpanDays(activity.fechaInicio, activity.fechaLimite);
                const deadlineBadge = formatDeadlineBadge(
                  activity.fechaInicio,
                  activity.fechaLimite,
                );
                const isTimeGrid = arg.view.type.includes("timeGrid");

                const tooltipContent = (
                  <TooltipContent
                    side="top"
                    align="start"
                    className="max-w-xs bg-popover text-popover-foreground border border-border shadow-lg p-0 rounded-lg overflow-hidden"
                  >
                    <div className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold text-white shrink-0"
                          style={{ background: priorityColor }}
                        >
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight">{activity.nombre}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {activity.id} · {activity.aplicacion}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <span className="text-muted-foreground">Responsable</span>
                        <span className="font-medium">{activity.responsable}</span>
                        <span className="text-muted-foreground">Estado</span>
                        <span className="font-medium">
                          {stateById[activity.estado_id]?.nombre ?? "—"}
                        </span>
                        <span className="text-muted-foreground">Prioridad</span>
                        <span className="font-medium">
                          {priorityById[activity.prioridad_id]?.nombre ?? "—"}
                        </span>
                        <span className="text-muted-foreground">Inicio</span>
                        <span className="font-medium">{formatDateShort(activity.fechaInicio)}</span>
                        <span className="text-muted-foreground">Límite</span>
                        <span className="font-medium">{formatDateShort(activity.fechaLimite)}</span>
                        {spanDays > 1 && (
                          <>
                            <span className="text-muted-foreground">Duración</span>
                            <span className="font-medium">
                              {spanDays} día{spanDays !== 1 ? "s" : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-border px-3 py-1.5 bg-muted/30">
                      <span className="text-[10px] text-muted-foreground">
                        Clic para editar · Arrastrar para mover
                      </span>
                    </div>
                  </TooltipContent>
                );

                if (isTimeGrid) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="fc-event-custom fc-event-custom--time">
                          <span className="fc-event-avatar" style={{ background: priorityColor }}>
                            {initials}
                          </span>
                          <div className="fc-event-custom-body">
                            <span className="fc-event-custom-title">{activity.nombre}</span>
                            <span className="fc-event-custom-meta">
                              {activity.responsable}
                              {deadlineBadge ? ` · ${deadlineBadge}` : ""}
                            </span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      {tooltipContent}
                    </Tooltip>
                  );
                }

                const mainContent = (
                  <div className="fc-event-custom">
                    <span className="fc-event-avatar" style={{ background: priorityColor }}>
                      {initials}
                    </span>
                    <div className="fc-event-custom-body">
                      <span className="fc-event-custom-title">{activity.nombre}</span>
                      {deadlineBadge && (
                        <span className="fc-event-range-badge">{deadlineBadge}</span>
                      )}
                    </div>
                  </div>
                );

                return (
                  <Tooltip>
                    <TooltipTrigger asChild>{mainContent}</TooltipTrigger>
                    {tooltipContent}
                  </Tooltip>
                );
              }}
              eventClick={(arg) => {
                arg.jsEvent.preventDefault();
                const activity = arg.event.extendedProps.activity as Activity | undefined;
                if (activity) onEdit?.(activity);
              }}
              datesSet={handleDatesSet}
            />
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="space-y-2 px-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {activeStates.map((state) => (
            <div key={state.id} className="flex items-center gap-1.5 text-[11px]">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: state.color }} />
              <span className="text-muted-foreground">{state.nombre}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Cada actividad aparece en su fecha de inicio · El badge → indica la fecha límite ·
          Arrastrar mueve el inicio
        </p>
      </div>
    </div>
  );
}
