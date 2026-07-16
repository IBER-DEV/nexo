import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { activitiesService } from "@/services/activitiesService";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/activities/PriorityBadge";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Activity, ActivityStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useSound } from "@/providers/SoundProvider";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban · Nexo" },
      { name: "description", content: "Tablero Kanban del equipo TI con arrastrar y soltar." },
    ],
  }),
  component: KanbanPage,
});

const COLUMNS: { id: ActivityStatus; title: string; accent: string }[] = [
  { id: "backlog", title: "Backlog", accent: "var(--status-backlog)" },
  { id: "in_progress", title: "En progreso", accent: "var(--status-progress)" },
  { id: "testing", title: "En pruebas", accent: "var(--status-testing)" },
  { id: "done", title: "Finalizado", accent: "var(--status-done)" },
];

function KanbanPage() {
  const qc = useQueryClient();
  const { play } = useSound();
  const { data, isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesService.list(),
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byColumn = useMemo(() => {
    const map: Record<string, Activity[]> = { backlog: [], in_progress: [], testing: [], done: [] };
    (data ?? []).forEach((a) => {
      if (map[a.estado]) map[a.estado].push(a);
    });
    return map;
  }, [data]);

  const active = data?.find((a) => a.id === activeId) ?? null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const dragId = String(e.active.id);
    const overCol = e.over?.id as ActivityStatus | undefined;
    if (!overCol) return;
    const item = data?.find((a) => a.id === dragId);
    if (!item || item.estado === overCol) return;
    await activitiesService.update(item.pk, { estado: overCol });
    qc.invalidateQueries({ queryKey: ["activities"] });
    toast.success(`Movida a ${STATUS_LABEL[overCol]}`);
    play("chime");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tablero Kanban"
        description="Arrastra las tarjetas entre columnas para cambiar el estado"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((c) => (
            <Skeleton key={c.id} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                accent={col.accent}
                items={byColumn[col.id] ?? []}
              />
            ))}
          </div>
          <DragOverlay>{active ? <KanbanCard activity={active} dragging /> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function KanbanColumn({
  id,
  title,
  accent,
  items,
}: {
  id: ActivityStatus;
  title: string;
  accent: string;
  items: Activity[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card
      ref={setNodeRef}
      className={`p-3 flex flex-col gap-3 min-h-[60vh] transition-colors ${isOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((a) => (
          <KanbanCardDraggable key={a.id} activity={a} />
        ))}
        {items.length === 0 && (
          <div className="text-xs text-muted-foreground italic text-center py-8 border border-dashed border-border rounded-lg">
            Sin tarjetas
          </div>
        )}
      </div>
    </Card>
  );
}

function KanbanCardDraggable({ activity }: { activity: Activity }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: activity.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={isDragging ? "opacity-30" : ""}>
      <KanbanCard activity={activity} />
    </div>
  );
}

function KanbanCard({ activity, dragging = false }: { activity: Activity; dragging?: boolean }) {
  const iniciales = activity.responsable
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      className={`group bg-card border border-border rounded-lg p-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${dragging ? "shadow-xl ring-2 ring-primary/50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] font-mono text-muted-foreground">{activity.id}</span>
        <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-sm font-medium line-clamp-2 mb-3">{activity.nombre}</p>
      <div className="flex items-center justify-between gap-2">
        <PriorityBadge priority={activity.prioridad} />
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
            {iniciales}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2">
        <Calendar className="h-3 w-3" />
        {format(new Date(activity.fechaLimite), "d MMM", { locale: es })}
      </div>
    </div>
  );
}
