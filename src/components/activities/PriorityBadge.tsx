import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/providers/WorkspaceProvider";

export function PriorityBadge({ prioridadId }: { prioridadId: number }) {
  const { priorityById } = useWorkspace();
  const priority = priorityById[prioridadId];
  if (!priority) return null;

  return (
    <Badge
      variant="outline"
      className="gap-1.5 font-medium bg-transparent"
      style={{ color: priority.color }}
    >
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: priority.color }} />
      {priority.nombre}
    </Badge>
  );
}
