import { createContext, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceService } from "@/services/workspaceService";
import type { ActivityType, Priority, WorkflowState, WorkspaceConfig } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

interface WorkspaceState {
  workspace: WorkspaceConfig | null;
  isLoading: boolean;
  kanbanStates: WorkflowState[];
  activeStates: WorkflowState[];
  activePriorities: Priority[];
  activeTypes: ActivityType[];
  stateById: Record<number, WorkflowState>;
  priorityById: Record<number, Priority>;
  typeById: Record<number, ActivityType>;
  initialState: WorkflowState | null;
  defaultPriority: Priority | null;
  isDone: (estadoId: number | null | undefined) => boolean;
  isCancelled: (estadoId: number | null | undefined) => boolean;
  isOpen: (estadoId: number | null | undefined) => boolean;
  refetch: () => void;
}

const empty: WorkspaceConfig = {
  organization: null,
  workflow_states: [],
  priorities: [],
  activity_types: [],
  version: "0",
  schema_version: 1,
};

const WorkspaceCtx = createContext<WorkspaceState>({
  workspace: null,
  isLoading: true,
  kanbanStates: [],
  activeStates: [],
  activePriorities: [],
  activeTypes: [],
  stateById: {},
  priorityById: {},
  typeById: {},
  initialState: null,
  defaultPriority: null,
  isDone: () => false,
  isCancelled: () => false,
  isOpen: () => true,
  refetch: () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => workspaceService.get(),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  const workspace = data ?? empty;

  const value = useMemo<WorkspaceState>(() => {
    const stateById: Record<number, WorkflowState> = {};
    workspace.workflow_states.forEach((s) => (stateById[s.id] = s));
    const priorityById: Record<number, Priority> = {};
    workspace.priorities.forEach((p) => (priorityById[p.id] = p));
    const typeById: Record<number, ActivityType> = {};
    workspace.activity_types.forEach((t) => (typeById[t.id] = t));

    const activeStates = [...workspace.workflow_states]
      .filter((s) => s.is_active)
      .sort((a, b) => a.orden - b.orden);
    const kanbanStates = activeStates.filter((s) => s.mostrar_en_kanban);
    const activePriorities = [...workspace.priorities]
      .filter((p) => p.is_active)
      .sort((a, b) => a.orden - b.orden);
    const activeTypes = [...workspace.activity_types].sort((a, b) => a.orden - b.orden);

    const categoriaOf = (estadoId: number | null | undefined) =>
      estadoId != null ? stateById[estadoId]?.categoria : undefined;

    return {
      workspace: data ?? null,
      isLoading,
      kanbanStates,
      activeStates,
      activePriorities,
      activeTypes,
      stateById,
      priorityById,
      typeById,
      initialState: activeStates.find((s) => s.is_initial) ?? null,
      defaultPriority: activePriorities.find((p) => p.is_default) ?? null,
      isDone: (estadoId) => categoriaOf(estadoId) === "done",
      isCancelled: (estadoId) => categoriaOf(estadoId) === "cancelled",
      isOpen: (estadoId) => {
        const cat = categoriaOf(estadoId);
        return cat !== "done" && cat !== "cancelled";
      },
      refetch: () => qc.invalidateQueries({ queryKey: ["workspace"] }),
    };
  }, [workspace, data, isLoading, qc]);

  // Evita parpadeo de contenido sin maestros mientras se revalida en segundo
  // plano (staleTime: Infinity ya impide refetches innecesarios).
  void isFetching;

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceCtx);
