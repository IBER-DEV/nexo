import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/providers/WorkspaceProvider";

export function StatusBadge({ estadoId }: { estadoId: number }) {
  const { stateById } = useWorkspace();
  const state = stateById[estadoId];
  if (!state) return null;

  return (
    <Badge
      variant="outline"
      className="font-medium border"
      style={{
        color: state.color,
        backgroundColor: `color-mix(in oklab, ${state.color} 15%, transparent)`,
        borderColor: `color-mix(in oklab, ${state.color} 30%, transparent)`,
        textDecoration: state.categoria === "cancelled" ? "line-through" : undefined,
      }}
    >
      {state.nombre}
    </Badge>
  );
}
