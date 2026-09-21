import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Activity } from "@/lib/types";

/** Valor del filtro: "all" (sin filtrar), "none" (solo actividades sin
 *  proyecto — la bandeja de trabajo huérfano) o el id del proyecto como
 *  string (Radix Select solo maneja strings). */
export type ProjectFilter = string;

export const PROJECT_FILTER_ALL: ProjectFilter = "all";
const NONE = "none";

/** Proyectos distintos presentes en una lista de actividades. Se derivan de
 *  las propias actividades (no de un fetch a /projects) para que el filtro
 *  solo ofrezca lo que de verdad existe en la vista actual — y para no
 *  cargar la lista completa de proyectos en cada pantalla. */
export function projectOptionsFrom(
  activities: Pick<Activity, "proyecto_id" | "proyecto">[],
): { id: number; nombre: string }[] {
  const map = new Map<number, string>();
  activities.forEach((a) => {
    if (a.proyecto_id != null) map.set(a.proyecto_id, a.proyecto);
  });
  return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  );
}

export function matchesProjectFilter(
  activity: Pick<Activity, "proyecto_id">,
  filter: ProjectFilter,
): boolean {
  if (filter === PROJECT_FILTER_ALL) return true;
  if (filter === NONE) return activity.proyecto_id == null;
  return String(activity.proyecto_id) === filter;
}

export function ProjectFilterSelect({
  value,
  onChange,
  activities,
  className = "w-52 h-9",
}: {
  value: ProjectFilter;
  onChange: (v: ProjectFilter) => void;
  activities: Pick<Activity, "proyecto_id" | "proyecto">[];
  className?: string;
}) {
  const options = useMemo(() => projectOptionsFrom(activities), [activities]);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Proyecto" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={PROJECT_FILTER_ALL}>Todos los proyectos</SelectItem>
        <SelectItem value={NONE}>Sin proyecto</SelectItem>
        {options.map((p) => (
          <SelectItem key={p.id} value={String(p.id)}>
            {p.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
